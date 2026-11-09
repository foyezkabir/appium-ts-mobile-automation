import {
  startSession,
  endSession,
  d,
  isAppUnderTestFrontmost,
} from '../src/support/driver';

/**
 * Harness — asserts the PLUMBING, not the product.
 *
 * Numbered 00 so it runs first. Green here is a precondition for trusting
 * anything else this suite reports: if it is red, every downstream failure is
 * ambiguous and you cannot tell a product defect from a broken session.
 *
 * NEVER weaken these assertions to get green.
 */
describe('Harness — Appium session plumbing', () => {
  // let, NEVER const, at spec top scope — the same script is evaluated more
  // than once per run (zero tolerance #6).
  let sessionId: string;

  beforeAll(async () => {
    let driver = await startSession();
    sessionId = driver.sessionId;
  });

  afterAll(async () => {
    await endSession();
  });

  test('TC01: a live Appium session exists', async () => {
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe('string');
  });

  test('TC02: the session is attached to the app under test', async () => {
    // With noReset the session attaches to whatever is FOREGROUND — one first
    // probe landed on the Play Store. Without this a suite can go green against
    // a different app entirely.
    //
    // The per-OS mechanism lives in driver.ts; the spec stays platform-neutral.
    expect(await isAppUnderTestFrontmost()).toBe(true);
  });

  test('TC03: the app rendered real content, not an empty tree', async () => {
    // Asserting only "not the login screen" would also pass on an empty tree,
    // so assert on real rendered text. RN paints its first frame ~700ms after
    // the launch intent returns — startSession() already gated on the app being
    // frontmost, so by here content is a fair expectation.
    let source = await d().getPageSource();
    let texts = [...source.matchAll(/text="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((t) => t.trim() !== '');

    expect(texts.length).toBeGreaterThan(0);
  });
});
