import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Runs ONCE before the whole run, before any Jest worker starts.
 *
 * testreportium's StepRecorder only APPENDS to steps.jsonl and the report pairs
 * steps to tests by name, so without this a previous run's steps show up again
 * under the same test. A project that needs more global setup (provisioning a
 * tenant, proving credentials) adds it here — keep the rmSync as the first line.
 *
 * No assertions (violation #7): a broken setup throws, it is not a result.
 */
export default async function globalSetup() {
  rmSync(join('appium-reports', 'steps.jsonl'), { force: true });
}
