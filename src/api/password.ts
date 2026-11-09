import * as fs from 'fs';
import * as path from 'path';
import * as api from './client';
import { credentials } from '../support/config';

// The suite has ONE login. A password test that changes it and then dies
// before changing it back would lock every later run out, and every spec would
// fail at the login screen looking like a product defect. So the temporary
// password is written to disk BEFORE the UI saves it, and whoever runs next —
// this file's afterAll, or global setup on the next run — can put the .env
// password back through the API. appium-reports/ is gitignored.
const IN_FLIGHT = path.resolve(__dirname, '../../appium-reports/.password-in-flight.json');

export function rememberPasswordInFlight(temporary: string) {
  fs.mkdirSync(path.dirname(IN_FLIGHT), { recursive: true });
  fs.writeFileSync(IN_FLIGHT, JSON.stringify({ temporary, at: new Date().toISOString() }));
}

// The UI put the .env password back itself — nothing left to recover.
export function forgetPasswordInFlight() {
  fs.rmSync(IN_FLIGHT, { force: true });
  api.resetToken(); // the cached token belongs to the password before the change
}

// NEVER THROWS: teardown and setup must not fail a run over a recovery step.
// Puts the .env password back if a run left the temporary one in place.
export async function restoreOriginalPassword() {
  if (!fs.existsSync(IN_FLIGHT)) return;
  let { email, password } = credentials();
  let { temporary } = JSON.parse(fs.readFileSync(IN_FLIGHT, 'utf8')) as { temporary: string };

  try {
    await api.loginToken(email, password);
    forgetPasswordInFlight(); // the change never landed, or was already undone
    return;
  } catch {
    // The .env password is refused — the temporary one is live. Fall through.
  }

  try {
    let token = await api.loginToken(email, temporary);
    await api.changePassword(token, temporary, password);
    api.resetToken();
    forgetPasswordInFlight();
    console.warn('[teardown] the account was left on the temporary password; restored the .env password via the API.');
  } catch (error) {
    console.warn(
      `[teardown] COULD NOT RESTORE THE PASSWORD. The temporary one is kept in ${IN_FLIGHT}. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// TC-11's last step: the temporary password back to the .env one, through
// PUT /customers/me/password. A step, not teardown — so it THROWS on failure,
// leaving the in-flight file for restoreOriginalPassword() to finish the job.
export async function changePasswordBackByApi(temporary: string) {
  let { email, password } = credentials();
  let token = await api.loginToken(email, temporary);
  await api.changePassword(token, temporary, password);
  forgetPasswordInFlight();
}
