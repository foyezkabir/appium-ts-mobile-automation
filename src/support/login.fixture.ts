import { startSession, endSession } from './driver';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { getProfile } from '../api/client';
import { loginCredentials } from '../data/booking.data';

export type LoginFixture = {
  login: LoginPage;
  nav: NavigationPage;
  creds: ReturnType<typeof loginCredentials>;
  displayName: string;
};

export function useLogin(): LoginFixture {
  let fx = {} as LoginFixture;

  beforeAll(async () => {
    await startSession();
    fx.login = new LoginPage();
    fx.nav = new NavigationPage();
    fx.creds = loginCredentials();
    fx.displayName = (await getProfile()).firstName;
    await fx.login.logOutIfLoggedIn(); // form cases need a logged-out app
  });

  afterAll(async () => {
    await endSession();
  });

  beforeEach(async () => {
    await fx.login.returnToTabRoute(); // login stack has no bottom nav
  });

  return fx;
}
