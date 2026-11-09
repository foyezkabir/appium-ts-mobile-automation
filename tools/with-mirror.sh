#!/usr/bin/env bash
# Run a jest command with a read-only scrcpy mirror alongside it.
# The mirror is OBSERVATION ONLY: --no-control, so a stray click cannot
# race the automation. Use `npm run mirror` when you want to drive by hand.
set -uo pipefail

SELF=$$          # capture here: inside a subshell, $$ still resolves to us
MIRROR_PID=""
# Never fail a run because the mirror could not start: no scrcpy, no display
# (CI), or no device yet. The tests are the deliverable; the window is not.
if command -v scrcpy >/dev/null 2>&1; then
  # NO --stay-awake HERE. scrcpy refuses to start with
  #   "ERROR: Cannot request to stay awake if control is disabled"
  # because --stay-awake needs control, and --no-control is the half we cannot
  # give up: a human click would race Appium for the same screen and redden a
  # passing test. Keeping the device awake is the device's own display setting,
  # not the mirror's job.
  #
  # Errors go to a LOG, never /dev/null. They were silenced here before, and the
  # mirror then failed invisibly on every single run — the tests passed, nobody
  # could see the screen, and nothing said why.
  mkdir -p appium-reports
  # shellcheck disable=SC2086  # APPIUM_UDID is deliberately unquoted-if-empty
  scrcpy --no-control \
         --window-title "Appium — RUNNING (read-only)" \
         ${APPIUM_UDID:+-s "$APPIUM_UDID"} >appium-reports/scrcpy.log 2>&1 &
  MIRROR_PID=$!
  # Watchdog. Traps alone are NOT enough: a Ctrl-C or a `kill -9` on this
  # script never runs them, and the mirror then outlives the run as a window
  # stuck over the device. This poll notices the script is gone by any means
  # and reaps the mirror. Verified against SIGTERM, SIGINT and SIGKILL.
  ( while kill -0 "$SELF" 2>/dev/null; do sleep 0.3; done
    kill "$MIRROR_PID" 2>/dev/null ) >/dev/null 2>&1 &
  WATCHDOG_PID=$!
else
  WATCHDOG_PID=""
  echo "note: scrcpy not found — running without a mirror." >&2
fi

# Reap the mirror and its watchdog on a normal exit and on a caught signal.
cleanup() {
  [ -n "$MIRROR_PID" ]   && kill "$MIRROR_PID"   2>/dev/null
  [ -n "$WATCHDOG_PID" ] && kill "$WATCHDOG_PID" 2>/dev/null
  MIRROR_PID=""; WATCHDOG_PID=""
}
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM
trap cleanup EXIT

# Run jest in the BACKGROUND and `wait` on it: bash defers a trap until a
# FOREGROUND child returns, so with jest in front the cleanup would not run
# until the whole suite finished — too late to matter on a Ctrl-C.
REPORT="$PWD/appium-reports/report.html"
MARKER=$(mktemp)   # run-start timestamp: only report a file THIS run wrote
node --experimental-vm-modules node_modules/.bin/jest "${@:2}" &
JEST_PID=$!
wait "$JEST_PID"
STATUS=$?
cleanup

# Last thing on screen: where the testreportium report is.
echo
if [ -f "$REPORT" ] && [ ! "$MARKER" -nt "$REPORT" ]; then   # same-second counts: bash 3.2 compares whole seconds
  echo "  Test report: $REPORT"
  echo "  Open it:     npm run report"
else
  echo "  No report was written by this run (expected $REPORT)."
fi
echo
rm -f "$MARKER"
exit "$STATUS"
