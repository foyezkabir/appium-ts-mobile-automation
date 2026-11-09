/**
 * jest.setup.ts — standing infrastructure, loaded via setupFilesAfterEnv.
 *
 * On a physical device you cannot see what the screen looked like when a test
 * failed, and the stack trace rarely says. This records the screen during each
 * test and, on failure, keeps the video and captures a screenshot plus the
 * page source into appium-reports/failures/, where testreportium embeds them.
 *
 * It wraps the global `it`/`test` rather than using an afterEach, because an
 * afterEach runs AFTER teardown has already navigated away — by then the
 * screen no longer shows the failure.
 */

import { StepRecorder, captureFailure, recordTest, finishRecording } from 'testreportium';

/** Screen recording of each test; kept only when the test fails. Android needs
 *  nothing extra; iOS needs ffmpeg on the Appium machine. Set false to skip. */
const RECORD = true;

/** jest-html-reporters' helper, loaded by a NON-LITERAL name: a suite that did
 *  not pick that report (Step 0) has no such package, and a literal import
 *  would fail to compile. With it installed, the failure screenshot is
 *  attached to the test in appium-reports/jest-report.html. */
const JEST_HTML_HELPER = 'jest-html-reporters/helper';

async function attachToJestReport(driver: Parameters<typeof captureFailure>[0]) {
  try {
    const { addAttach } = await import(JEST_HTML_HELPER);
    const png = Buffer.from(await driver.takeScreenshot(), 'base64');
    await addAttach({ attach: png, description: 'Screen at failure', bufferFormat: 'png' });
  } catch {
    return; // not installed, or no screen: never mask the real failure
  }
}

/** The live session, or undefined when there is none (not an error). Imported
 *  lazily: at module load the driver does not exist yet. Typed as the
 *  testreportium helpers' own parameters — NOT ReturnType<typeof d>: if d()'s
 *  signature is `never` (it throws when there is no session) that collapses to
 *  `never` and every use below becomes a compile error, failing the whole
 *  suite before a single test runs. */
async function liveDriver() {
  try {
    const { d } = await import('./src/support/driver');
    return d() as unknown as Parameters<typeof captureFailure>[0] & Parameters<typeof recordTest>[0];
  } catch {
    return undefined;
  }
}

/**
 * Wrap the global test fn so a throwing body is captured, then RE-THROWN.
 * Swallowing here would turn every failure green — the exact thing violation
 * #3 exists to prevent. The testreportium helpers never throw, so a capture or
 * recording problem can never fail or mask a test either.
 */
function wrap(original: jest.It): jest.It {
  const wrapped = ((name: string, fn?: jest.ProvidesCallback, timeout?: number) => {
    if (!fn) return original(name, fn as never, timeout);
    const inner = async (...args: unknown[]) => {
      const driver = await liveDriver();
      const recording = RECORD && driver ? await recordTest(driver) : false;
      try {
        // Cast through a call signature rather than `any`: the gate does not
        // enable no-explicit-any (see eslint.config.mjs), so a disable comment
        // for it would reference an undefined rule and fail lint.
        const result = await (fn as (...a: unknown[]) => unknown)(...args);
        if (recording && driver) await finishRecording(driver, name, { keep: false });
        return result;
      } catch (err) {
        // `name` is the test's own title — what testreportium pairs files on.
        // Its captureFailure() names the files with the package's own slug(),
        // so the report and the capture can never drift apart. Never hand-copy
        // slug() here: a drift silently drops every image from the report.
        const now = (await liveDriver()) ?? driver;
        if (now) await captureFailure(now, name);
        if (now) await attachToJestReport(now);
        if (recording && now) await finishRecording(now, name, { keep: true });
        throw err; // ALWAYS re-throw
      }
    };
    return original(name, inner as jest.ProvidesCallback, timeout);
  }) as jest.It;

  // Preserve .each / .only / .skip / .todo / .failing.
  return Object.assign(wrapped, original);
}

global.it = wrap(global.it);
global.test = wrap(global.test);

/**
 * STEP PAIRING — tells testreportium which test each BasePage step belongs to.
 *
 * A beforeEach, not inside wrap(): registered here it runs BEFORE every other
 * beforeEach (the login check below, any fixture's), so steps those hooks take
 * are filed under the test they prepare instead of the previous one. The name
 * is Jest's full name (describe + title) — what the report pairs on. Cleared
 * after each test so afterAll teardown steps do not land on the last test.
 */
beforeEach(() => StepRecorder.setTest(expect.getState().currentTestName ?? ''));
afterEach(() => StepRecorder.setTest(''));

/**
 * GLOBAL LOGIN — one place for every spec, whether one case, several, or a
 * whole file is run. Once per file it proves the session is live on the
 * DASHBOARD (a named greeting, no sign-in sheet) and signs in if not; before
 * EVERY test it re-checks the screen without navigating. No fixture or spec
 * does this.
 *
 * Two specs are exempt because the login state IS their subject:
 *   - login.spec.ts  — tests the logged-out screens and logs out on purpose
 *   - 00-harness     — proves the plumbing with nothing in front of it
 *
 * Registered here, these hooks run BEFORE any fixture's hooks, so a fixture's
 * own startSession() just returns this session.
 */
const LOGIN_EXEMPT = ['00-harness.spec.ts', 'login.spec.ts'];
const testFile: string = expect.getState().testPath ?? '';

if (!LOGIN_EXEMPT.some((name) => testFile.endsWith(name))) {
  // Once per file: PROVE the session on the dashboard; sign in if it asks. A
  // session revoked by a password change looks signed in until the first API
  // call fails, so a look at the screen alone is not enough (2026-09-25).
  beforeAll(async () => {
    const { startSession } = await import('./src/support/driver');
    const { LoginPage } = await import('./src/pages/login.page');
    await startSession();
    await new LoginPage().ensureSessionIsLive();
  });
  // Before each test: the light check — reads the screen, never navigates.
  beforeEach(async () => {
    const { LoginPage } = await import('./src/pages/login.page');
    await new LoginPage().ensureLoggedIn();
  });
}

export {};
