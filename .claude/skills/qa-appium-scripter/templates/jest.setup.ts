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
        // `any` is deliberate: fn's signature varies (done-callback vs async).
        // NO eslint-disable here — the config loads the parser and no rule
        // presets, so @typescript-eslint/no-explicit-any does not exist and a
        // directive naming it makes ESLint itself error, reddening the gate on
        // a clean scaffold. Verified in a cold sandbox.
        const result = await (fn as any)(...args);
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
 * A beforeEach, NOT inside wrap(): registered here it runs BEFORE every other
 * beforeEach (a fixture's, a login check's), so the steps those hooks take are
 * filed under the test they prepare instead of the previous one. The name is
 * Jest's full name (describe + title), which is what the report pairs on.
 * Cleared after each test so afterAll teardown steps do not land on the last
 * test.
 */
beforeEach(() => StepRecorder.setTest(expect.getState().currentTestName ?? ''));
afterEach(() => StepRecorder.setTest(''));

export {};
