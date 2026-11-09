import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from the PROJECT ROOT, not from the cwd jest happens to run in.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Anything identifying an ENVIRONMENT or a TENANT is required, never defaulted.
function required(name: string): string {
  let value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill every value — see CLAUDE.md "Setup".`,
    );
  }
  return value.trim();
}

// Only genuinely environment-INDEPENDENT values keep a fallback.
function optional(name: string, fallback: string): string {
  let value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

export type Platform = 'android' | 'ios';
export type Framework = 'native' | 'rn' | 'flutter' | 'hybrid';

export const PLATFORM = required('APPIUM_PLATFORM').toLowerCase() as Platform;
export const FRAMEWORK = required('APPIUM_FRAMEWORK').toLowerCase() as Framework;
export const AUTOMATION = required('APPIUM_AUTOMATION');

export const APP_ID = required('APPIUM_APP_ID');
export const UDID = required('APPIUM_UDID');

// [android] only.
export const APP_ACTIVITY = process.env.APPIUM_APP_ACTIVITY?.trim() ?? '';

// [ios] only.
export const iosDeviceName = () => required('APPIUM_DEVICE_NAME');
export const iosPlatformVersion = () => required('APPIUM_PLATFORM_VERSION');
export const iosTeamId = () => required('APPIUM_TEAM_ID');

export const HOST = optional('APPIUM_HOST', '127.0.0.1');
export const PORT = Number(optional('APPIUM_PORT', '4723'));

// The customer API the SEEDING layer talks to.
export const API_BASE_URL = required('API_BASE_URL');

// The installed app's display name, as it is painted on screen. Asserted
// against, so it is the app's own vocabulary — but it is also the app's brand,
// so it lives here and not in source.
export const APP_BRAND_NAME = required('APP_BRAND_NAME');

// Tenant seeding: the mailbox domain and the shared password of the accounts the
// suite provisions. Required, never defaulted — a wrong default would create
// accounts on a domain nobody controls.
export const TENANT_EMAIL_DOMAIN = required('TENANT_EMAIL_DOMAIN');
export const TENANT_SEED_PASSWORD = required('TENANT_SEED_PASSWORD');

// Credentials — required, never invented.
export const credentials = () => ({
  email: required('APP_EMAIL'),
  password: required('APP_PASSWORD'),
});

// Timeouts.
export const TIMEOUTS = {
  // Waiting for an element to appear after a navigation or a re-render.
  visible: 20_000,
  // Waiting for an element to disappear (a spinner, a dismissed sheet).
  gone: 20_000,
  // Waiting for a screen's first real content after a launch or a submit.
  content: 30_000,
  // Polling interval for every waitUntil in the suite.
  interval: 400,
} as const;

export const isAndroid = () => PLATFORM === 'android';
export const isIOS = () => PLATFORM === 'ios';
export const isRN = () => FRAMEWORK === 'rn';
