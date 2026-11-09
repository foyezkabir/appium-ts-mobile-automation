import { startSession, endSession, clearGallery } from './driver';
import { credentials } from './config';
import { ErrorHelper } from './ErrorHelper';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { ProfilePage } from '../pages/profile.page';
import { DashboardPage } from '../pages/dashboard.page';
import { AppointmentsPage } from '../pages/appointments.page';
import { clearAllUpcoming, type SeededAppointment } from '../api/seed';
import { snapshotProfile, restoreProfile, profileDifferences } from '../api/profile';
import { restoreOriginalPassword } from '../api/password';
import { mainDoctor } from '../data/fixtures';
import { profileEdits, healthListEdits, invalidProfile, passwordEdits, outsideAllergy, type ProfileEdits } from '../data/profile.data';
import type { CustomerProfile } from '../api/client';
import type { ProvisionedDoctor } from '../api/tenant';

export type ProfileFixture = {
  login: LoginPage;
  nav: NavigationPage;
  profile: ProfilePage;
  dashboard: DashboardPage;
  appointments: AppointmentsPage;
  email: string;
  originalPassword: string;
  original: CustomerProfile; // as the run found it — every test is restored to it
  edits: ProfileEdits;
  health: ReturnType<typeof healthListEdits>;
  invalid: ReturnType<typeof invalidProfile>;
  passwords: ReturnType<typeof passwordEdits>;
  outsideAllergy: string;
  doctor: ProvisionedDoctor;
  counts: { prescriptions: number; upcoming: number };
  seeded: SeededAppointment | undefined;
  photoBefore: string | null;
  appIsStale: boolean; // set only when teardown had to restore through the API
};

export function useProfile(): ProfileFixture {
  let fx = {} as ProfileFixture;

  beforeAll(async () => {
    await restoreOriginalPassword(); // a previous run may have died mid-change
    await startSession();
    fx.login = new LoginPage();
    fx.nav = new NavigationPage();
    fx.profile = new ProfilePage();
    fx.dashboard = new DashboardPage();
    fx.appointments = new AppointmentsPage();
    ({ email: fx.email, password: fx.originalPassword } = credentials());
    fx.original = await snapshotProfile();
    fx.edits = profileEdits(fx.original);
    fx.health = healthListEdits(fx.original);
    fx.invalid = invalidProfile();
    fx.passwords = passwordEdits();
    fx.outsideAllergy = outsideAllergy(fx.original);
    fx.doctor = mainDoctor();
  });

  beforeEach(async () => {
    fx.seeded = undefined;
    await clearAllUpcoming();
    if (fx.appIsStale) {
      await fx.profile.reloadMyProfile(); // the one pull, after an API fallback only
      fx.appIsStale = false;
    }
    await fx.nav.goHome();
  });

  // Every change a test makes goes through the UI, and so does its undo: the
  // app's own copy of the profile then stays current, so no test needs a
  // reload or a restart before it. Nothing changed -> nothing is done. The API
  // restore is only the fallback when the UI restore fails or does not land.
  afterEach(async () => {
    await clearAllUpcoming();
    clearGallery();
    let now = await snapshotProfile();
    if (profileDifferences(now, fx.original).length === 0) return;
    await ErrorHelper.tryOrElse(() => fx.profile.restoreThroughUi(now, fx.original), async () => undefined);
    let still = profileDifferences(await snapshotProfile(), fx.original);
    if (still.length > 0) {
      console.warn(`[teardown] the UI restore did not put back: ${still.join(', ')} — restoring through the API (the app will be stale until reloaded).`);
      await restoreProfile(fx.original);
      fx.appIsStale = true;
    }
  });

  // A password change revokes every session, the app's too. So after the
  // password tests, sign the app back in: no later case — in this run or the
  // next — may meet a dead session and its "Sign in to continue" sheet.
  afterAll(async () => {
    await restoreOriginalPassword(); // only acts if TC-11 died before putting it back
    if (profileDifferences(await snapshotProfile(), fx.original).length > 0) await restoreProfile(fx.original);
    await ErrorHelper.warnOnFailure(() => fx.login.ensureSessionIsLive(), 'could not sign the app back in after the password tests');
    await endSession();
  });

  return fx;
}
