import { execFileSync } from 'child_process';
import { remote, type Browser } from 'webdriverio';
import { recordSession } from 'testreportium';
import {
  PLATFORM,
  AUTOMATION,
  APP_ID,
  APP_ACTIVITY,
  UDID,
  HOST,
  PORT,
  TIMEOUTS,
  isAndroid,
  iosDeviceName,
  iosPlatformVersion,
  iosTeamId,
} from './config';

// Session lifecycle.

let driver: Browser | undefined;

// Capabilities are built FROM the platform, never hardcoded.
function capabilities(): Record<string, unknown> {
  let base = {
    'appium:automationName': AUTOMATION,
    'appium:udid': UDID,
    // Attach to the installed build rather than reinstalling — see the
    // activateApp proof below for why this needs guarding.
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
  };

  if (isAndroid()) {
    return {
      platformName: 'Android',
      ...base,
      'appium:appPackage': APP_ID,
      'appium:appActivity': APP_ACTIVITY,
      // RN's first frame lands ~700ms after the launch intent returns; do not
      // let Appium declare the session ready on the intent alone.
      'appium:appWaitActivity': '*',
      'appium:appWaitForLaunch': true,
    };
  }

  // [ios] NO appActivity — passing one to XCUITest is an error, not a no-op.
  return {
    platformName: 'iOS',
    ...base,
    'appium:bundleId': APP_ID,
    'appium:deviceName': iosDeviceName(),
    'appium:platformVersion': iosPlatformVersion(),
    'appium:xcodeOrgId': iosTeamId(),
    'appium:xcodeSigningId': 'iPhone Developer',
  };
}

// A device clock skew invalidates every current TLS certificate and fails the app network-wide — [android] "Trust anchor for certification path not found", [ios] NSURLErrorDomain -1202.
async function assertDeviceClockIsSane(): Promise<void> {
  if (!isAndroid()) return;

  // Read the clock over adb, NOT via `mobile: shell`. Appium gates adb_shell
  // behind --allow-insecure, and requiring that would make every developer
  // relax their server's security posture to run the suite. adb is already a
  // hard prerequisite, so this costs nothing extra.
  let raw: string;
  try {
    raw = execFileSync('adb', ['-s', UDID, 'shell', 'date', '+%s'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
  } catch {
    // adb unavailable or the device dropped off between preflight and here.
    // Not a clock fault — do not fail the session over a diagnostic.
    return;
  }

  let deviceEpoch = Number(raw.trim());
  if (!Number.isFinite(deviceEpoch)) return;

  let skewSeconds = Math.abs(deviceEpoch - Math.floor(Date.now() / 1000));
  if (skewSeconds > 300) {
    throw new Error(
      `Device clock is ${Math.round(skewSeconds / 60)} min off host time. ` +
        `This invalidates current TLS certificates and fails the app network-wide ` +
        `with errors that look like auth or API bugs. Fix the device clock first.`,
    );
  }
}

// noReset: true attaches to whatever is FOREGROUND — one first probe of an app landed on the Play Store.
async function assertCorrectAppIsFrontmost(d: Browser): Promise<void> {
  await d.activateApp(APP_ID);

  await d.waitUntil(
    async () => {
      if (isAndroid()) {
        // [android] getCurrentPackage. NEVER call this on iOS — it throws.
        return (await d.getCurrentPackage()) === APP_ID;
      }
      // [ios] 4 === running in foreground.
      return (await d.queryAppState(APP_ID)) === 4;
    },
    {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg:
        `${APP_ID} did not become the foreground app within ${TIMEOUTS.content}ms. ` +
        `With noReset the session attaches to whatever is in front — check the app id.`,
    },
  );
}

export async function startSession(): Promise<Browser> {
  if (driver) return driver;

  driver = await remote({
    hostname: HOST,
    port: PORT,
    path: '/',
    logLevel: 'error',
    capabilities: capabilities(),
  });

  await assertDeviceClockIsSane();
  await assertCorrectAppIsFrontmost(driver);
  // Device, OS, Appium version, UDID, automation → the report's Environment
  // block. After the frontmost check, so framework detection reads OUR app's
  // tree. Never throws: a missing detail leaves that row out.
  await recordSession(driver);

  return driver;
}

// The live session.
export function d(): Browser {
  if (!driver) {
    throw new Error('No Appium session. Call startSession() in beforeAll first.');
  }
  return driver;
}

// Is the app under test the frontmost app right now?
export async function isAppUnderTestFrontmost(): Promise<boolean> {
  if (isAndroid()) {
    return (await d().getCurrentPackage()) === APP_ID;
  }
  return (await d().queryAppState(APP_ID)) === 4;
}

// Something outside the app can end up in front — Android's Quick Share after a
// link is copied, another app's permission dialog. Bring the app back.
export async function bringAppToFront(): Promise<void> {
  await d().activateApp(APP_ID);
}

// A leaked session locks the device out of the next run.
export async function endSession(): Promise<void> {
  if (!driver) return;
  let session = driver;
  driver = undefined;
  await session.deleteSession();
}

// The folder test photos are pushed to. Named QA-AUTO so a leftover is greppable.
const GALLERY_DIR = '/sdcard/Pictures/QA-AUTO';

// Put a photo in the device gallery so the system photo picker offers it —
// FIRST, because the picker lists newest first (device-verified 2026-09-25).
export function pushToGallery(localPath: string, name: string) {
  if (!isAndroid()) {
    throw new Error('pushToGallery: [ios] not implemented — no iOS target has been run against this suite.');
  }
  let target = `${GALLERY_DIR}/${name}`;
  execFileSync('adb', ['-s', UDID, 'shell', 'mkdir', '-p', GALLERY_DIR], { timeout: 20_000 });
  execFileSync('adb', ['-s', UDID, 'push', localPath, target], { timeout: 120_000 });
  execFileSync('adb', ['-s', UDID, 'shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${target}`], { timeout: 20_000 });
}

// [android] Android shows a clipboard pop-up for a few seconds after an app copies,
// with a "nearby share" chip at the bottom-left — over the tab bar. A tap that
// lands on it opens Quick Share and strands the next test (device-verified
// 2026-10-07: ClipboardOverlay window, ~5 s). Wait for it to go.
export async function waitForClipboardOverlayToClose(): Promise<void> {
  if (!isAndroid()) return;
  await d().waitUntil(
    async () => !execFileSync('adb', ['-s', UDID, 'shell', 'dumpsys', 'window', 'windows'], { timeout: 20_000 }).toString().includes('ClipboardOverlay'),
    { timeout: TIMEOUTS.visible, interval: 500, timeoutMsg: 'The clipboard pop-up never closed after the copy.' },
  );
}

// NEVER THROWS — teardown. Removes the pushed photos and their gallery entries.
export function clearGallery() {
  if (!isAndroid()) return;
  try {
    execFileSync('adb', ['-s', UDID, 'shell', 'rm', '-rf', GALLERY_DIR], { timeout: 20_000 });
    execFileSync('adb', ['-s', UDID, 'shell', `content delete --uri content://media/external/images/media --where "_display_name LIKE 'qa-%'"`], { timeout: 20_000 });
  } catch (error) {
    console.warn(`[teardown] could not clear ${GALLERY_DIR}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// [android] Type through the DEVICE KEYBOARD (adb input), not UiAutomator's
// setText. An RN field that commits on the keyboard's Enter never sees setText:
// the Others custom-condition box stayed plain text until real key events were
// sent (device-verified 2026-09-25).
export function typeOnDeviceKeyboard(text: string) {
  if (!isAndroid()) throw new Error('typeOnDeviceKeyboard: [ios] not implemented — no iOS target has been run against this suite.');
  execFileSync('adb', ['-s', UDID, 'shell', 'input', 'text', text.replace(/ /g, '%s')], { timeout: 20_000 });
}

export function pressDeviceEnter() {
  if (!isAndroid()) throw new Error('pressDeviceEnter: [ios] not implemented — no iOS target has been run against this suite.');
  execFileSync('adb', ['-s', UDID, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'], { timeout: 20_000 });
}
