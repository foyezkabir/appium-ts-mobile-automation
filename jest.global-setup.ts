import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { provisionTenant } from './src/api/tenant';
import { getProfile } from './src/api/client';
import { restoreOriginalPassword } from './src/api/password';

/**
 * Runs ONCE before the whole suite, before any Jest worker starts.
 *
 * Two jobs, in order:
 *
 *   1. Prove the credentials work. If login fails, every spec would fail at its
 *      first screen and the run would look like 59 product defects. Failing here
 *      instead names the real cause once. (This happened for real on 2026-09-23,
 *      when the password rotated.)
 *
 *   2. Provision the tenant — doctors, chambers, fees and availability. The
 *      database can be empty; a suite pinned to a named doctor then fails at the
 *      first locator. Bootstrap is idempotent, so on a populated tenant it
 *      creates nothing and reuses what is there.
 *
 * NO ASSERTIONS (zero tolerance #7) — a broken setup throws, it does not report
 * a test result.
 */
export default async function globalSetup(): Promise<void> {
  // testreportium's StepRecorder only APPENDS to steps.jsonl, and the report
  // pairs steps by test name — so a previous run's steps would show up again
  // under the same test. Start every run with an empty step log.
  rmSync(join('appium-reports', 'steps.jsonl'), { force: true });

  // A run that died between the profile password tests leaves the account on a
  // temporary password; put the .env one back BEFORE proving the credentials.
  await restoreOriginalPassword();

  let profile = await getProfile().catch((error: unknown) => {
    throw new Error(
      `[global-setup] Could not sign in as the customer. Every spec would fail ` +
        `at the login screen and the run would look like a product defect.\n` +
        `Check APP_EMAIL / APP_PASSWORD in .env against the live environment.\n` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  console.log(`[global-setup] customer: ${profile.firstName} ${profile.lastName}`);

  let doctors = await provisionTenant();
  for (let doctor of doctors) {
    console.log(
      `[global-setup] doctor: ${doctor.fullName} (${doctor.primarySpeciality}) — ` +
        `${doctor.chambers.length} chamber(s)`,
    );
  }
}
