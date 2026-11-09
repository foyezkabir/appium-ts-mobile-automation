import { BasePage } from './base.page';
import { d } from '../support/driver';
import { APP_BRAND_NAME, credentials, TIMEOUTS } from '../support/config';
import { DASHBOARD_TEXT } from '../locators/dashboard.locators';
import { FORGOT_PASSWORD_A11Y, FORGOT_PASSWORD_TEXT, SIGNED_IN_GREETING_PATTERN, LOGIN_A11Y, LOGIN_FIELD_INDEX, LOGIN_TEXT, LOGOUT_A11Y, LOGOUT_TEXT, SIGNIN_PROMPT_A11Y, SIGNIN_PROMPT_TEXT } from '../locators/login.locators';
import { NAV_A11Y } from '../locators/nav.locators';
import { PROFILE_TEXT } from '../locators/profile.locators';

export class LoginPage extends BasePage {
  private get continueToPortals() {
    return this.byA11y(LOGIN_A11Y.continueToPortals);
  }

  private get customerPortal() {
    return this.byA11y(LOGIN_A11Y.customerPortal);
  }

  private get emailTab() {
    return this.byA11y(LOGIN_A11Y.emailTab);
  }

  private get signInButton() {
    return this.byA11y(LOGIN_A11Y.signIn);
  }

  private get profileTab() {
    return this.byA11y(NAV_A11Y.profile);
  }

  private get emailInput() {
    return this.editTextAt(LOGIN_FIELD_INDEX.email); // no a11y id; order is fixed
  }

  private get passwordInput() {
    return this.editTextAt(LOGIN_FIELD_INDEX.password);
  }

  private get dashboardMarker() {
    return this.byText(DASHBOARD_TEXT.glanceSubheading);
  }

  async isLoggedIn(): Promise<boolean> {
    let source = await this.decodedPageSource();

    // Only these two prove a LOGGED-OUT app. The logged-out shell also renders
    // the dashboard chrome — "Here's your health at a glance" with an empty
    // greeting — so the subheading proves nothing either way.
    if (source.includes(LOGIN_TEXT.signInSheetHeading)) return false;
    if (source.includes(LOGIN_TEXT.signInHeading)) return false;

    // Neither signal appears on an inner screen (doctor search, a profile, a
    // booking step), so the UI cannot answer without navigating — and
    // navigating mid-module drags the app off the screen under test. Read it
    // from the session instead: no tap, no side effect, no screen change.
    return true;
  }

  async returnToTabRoute() {
    await this.hideKeyboard();
    await d().waitUntil(
      async () => {
        if (await this.isVisible(this.profileTab)) return true;
        await this.goBack();
        return this.isVisible(this.profileTab);
      },
      {
        timeout: TIMEOUTS.content,
        interval: TIMEOUTS.interval,
        timeoutMsg: 'Bottom nav never reappeared after backing out of the login stack.',
      },
    );
  }

  async openEmailLoginForm() {
    await this.tap(this.profileTab, 'Profile tab'); // prompt label differs per tab
    await this.tap(this.continueToPortals, 'Continue (sign-in sheet)');
    await this.waitForText(LOGIN_TEXT.portalChooserHeading);

    await this.tap(this.customerPortal, 'Customer Portal');
    await this.waitForText(LOGIN_TEXT.signInHeading);

    await this.tap(this.emailTab, 'Email tab'); // screen opens on Mobile Number
    await this.waitForText(LOGIN_TEXT.emailTabHint);
  }

  async enterCredentials(email: string, password: string) {
    await this.fill(this.emailInput, email, 'Email input');
    await this.fill(this.passwordInput, password, 'Password input');
    await this.hideKeyboard();
  }

  async tickRememberMe() {
    await this.tap(this.byA11y(LOGIN_A11Y.rememberMe), 'Remember me checkbox');
  }

  async untickRememberMe() {
    await this.tap(this.byA11y(LOGIN_A11Y.rememberMe), 'Remember me checkbox');
  }

  async isRememberMeChecked(): Promise<boolean> {
    let box = this.byA11y(LOGIN_A11Y.rememberMe);
    await this.waitVisible(box, 'Remember me checkbox');
    return (await box.getAttribute('checked')) === 'true';
  }

  async openTab(tab: (typeof NAV_A11Y)[keyof typeof NAV_A11Y]) {
    await this.tap(this.byA11y(tab), `${tab} tab`);
  }

  private async expectSignInPromptOnTab(
    tab: (typeof NAV_A11Y)[keyof typeof NAV_A11Y],
    body: string,
    cta: string,
  ) {
    await this.openTab(tab);
    await this.waitForText(SIGNIN_PROMPT_TEXT.heading);
    await this.waitForText(body);
    await this.waitVisible(this.byA11y(cta), `${cta} button on the ${tab} tab`);
    await this.waitVisible(this.byA11y(SIGNIN_PROMPT_A11Y.signUp), 'Sign up link');
  }

  async expectBookingsTabPromptsSignIn() {
    await this.expectSignInPromptOnTab(
      NAV_A11Y.bookings,
      SIGNIN_PROMPT_TEXT.bookings,
      SIGNIN_PROMPT_A11Y.signIn,
    );
  }

  async expectHomeTabPromptsSignIn() {
    await this.expectSignInPromptOnTab(
      NAV_A11Y.home,
      SIGNIN_PROMPT_TEXT.home,
      SIGNIN_PROMPT_A11Y.signIn,
    );
  }

  async expectPrescriptionTabPromptsSignIn() {
    await this.expectSignInPromptOnTab(
      NAV_A11Y.prescription,
      SIGNIN_PROMPT_TEXT.prescription,
      SIGNIN_PROMPT_A11Y.signIn,
    );
  }

  async expectProfileTabPromptsContinue() {
    await this.expectSignInPromptOnTab(
      NAV_A11Y.profile,
      SIGNIN_PROMPT_TEXT.profile,
      SIGNIN_PROMPT_A11Y.continue,
    );
  }

  async expectSearchTabHasNoSignInPrompt() {
    await this.openTab(NAV_A11Y.search);
    await this.waitGone(this.byText(SIGNIN_PROMPT_TEXT.heading), 'sign-in prompt on Search');
  }

  async openForgotPassword() {
    await this.tap(this.byA11y(LOGIN_A11Y.forgotPassword), 'Forgot password link');
    await this.waitForText(FORGOT_PASSWORD_TEXT.heading);
  }

  async backToSignInFromForgotPassword() {
    await this.tap(this.byA11y(FORGOT_PASSWORD_A11Y.backToSignIn), 'Back to Sign In');
    await this.waitForText(LOGIN_TEXT.signInHeading);
  }

  async isSubmitEnabled(): Promise<boolean> {
    await this.waitVisible(this.signInButton, 'Sign In button');
    return (await this.signInButton.getAttribute('enabled')) === 'true';
  }

  // Open the form, type the pair and submit — the three steps every rejection
  // case repeats. Stops at the submit; the caller asserts the outcome.
  async signInWith(email: string, password: string) {
    await this.openEmailLoginForm();
    await this.enterCredentials(email, password);
    await this.submit();
  }

  // Submit again on the form that is already open — after a rejected attempt
  // the app stays on it, so reopening from the Profile tab is impossible.
  async resubmitWith(email: string, password: string) {
    await this.enterCredentials(email, password);
    await this.submit();
  }

  // Open the form and type the pair WITHOUT submitting, for the cases that
  // assert the button's enabled state rather than a login outcome.
  async fillSignInForm(email: string, password: string) {
    await this.openEmailLoginForm();
    await this.enterCredentials(email, password);
  }

  async submit() {
    await this.scrollFieldIntoReach(LOGIN_TEXT.signInHeading);

    if (!(await this.isSubmitEnabled())) {
      throw new Error(
        'Sign In is disabled, so the form was never submitted — the app disables ' +
          'it while the fields are empty.',
      );
    }

    await this.tap(this.signInButton, 'Sign In button');
  }

  async logOutIfLoggedIn() {
    if (!(await this.isLoggedIn())) return;

    // The app starts wherever the previous run left it — often an inner screen with no tab bar.
    await this.returnToTabRoute();
    await this.tap(this.profileTab, 'Profile tab');
    await this.confirmLogOut();
  }

  // Log out is in My Profile's sticky footer — always on screen, no scrolling.
  private async confirmLogOut() {
    await this.tap(this.byA11y(LOGOUT_A11Y.logOut), 'Log out (profile)');
    await this.waitForText(LOGOUT_TEXT.confirmHeading); // sheet reuses the same label
    await this.tap(this.byA11y(LOGOUT_A11Y.confirmLogOut), 'Log out (confirm)');
    await this.tap(this.profileTab, 'Profile tab'); // logout lands on Home
    await this.waitVisible(this.continueToPortals, 'Continue (logged-out prompt)');
  }

  // Right after a password change: log out AT ONCE. The session is already
  // revoked, but the app does not say so (it jumps to Select doctor), so this
  // opens Profile and takes whichever answer comes first — the sign-in sheet
  // (already signed out: done) or the Log out button (log out now).
  async logOutAfterPasswordChange() {
    await this.returnToTabRoute();
    await this.tap(this.profileTab, 'Profile tab');
    let signedIn = false;
    await d().waitUntil(
      async () => {
        if ((await this.decodedPageSource()).includes(LOGIN_TEXT.signInSheetHeading)) return true;
        signedIn = await this.isVisible(this.byA11y(LOGOUT_A11Y.logOut));
        return signedIn;
      },
      { timeout: TIMEOUTS.visible, interval: TIMEOUTS.interval, timeoutMsg: 'Profile showed neither Log out nor the sign-in sheet after the password change.' },
    );
    if (signedIn) await this.confirmLogOut();
  }

  async loginWithValidCredentials() {
    let { email, password } = credentials();
    await this.openEmailLoginForm();
    await this.enterCredentials(email, password);
    await this.submit();
    await this.expectLoginSucceeded();
  }

  async ensureLoggedIn() {
    // Reads the current screen and does NOT navigate when already signed in —
    // a module's tests must stay on the screen under test. Only the recovery
    // path moves the app, and only because it has to log in.
    if (await this.isLoggedIn()) return;

    await this.hideKeyboard();
    await this.returnToTabRoute();
    await this.loginWithValidCredentials();
  }

  // Proves the session on the DASHBOARD — the screen a signed-in user lands on.
  // Signed in = the greeting carries a name AND no sign-in sheet appears for
  // 3 s: a session revoked by a password change still shows the cached greeting
  // until its first API call fails and the sheet appears. Signed out = the
  // sheet or the sign-in screen — then it signs in.
  async ensureSessionIsLive() {
    await this.returnToTabRoute();
    await this.tap(this.byA11y(NAV_A11Y.home), 'Home tab');
    let signedInSince = 0;
    let signedOut = false;
    await d().waitUntil(
      async () => {
        let source = await this.decodedPageSource();
        if (source.includes(LOGIN_TEXT.signInSheetHeading) || source.includes(LOGIN_TEXT.signInHeading)) {
          signedOut = true;
          return true;
        }
        if (!SIGNED_IN_GREETING_PATTERN.test(source)) {
          signedInSince = 0;
          return false;
        }
        signedInSince ||= Date.now();
        return Date.now() - signedInSince >= 3000;
      },
      { timeout: TIMEOUTS.content, interval: TIMEOUTS.interval, timeoutMsg: 'The dashboard showed neither a named greeting nor a sign-in prompt.' },
    );
    if (signedOut) await this.loginWithValidCredentials();
  }

  async expectEmailFormIsOpen() {
    await this.waitForText(LOGIN_TEXT.emailTabHint);
    await this.waitVisible(this.signInButton, 'Sign In button');
  }

  async expectLoginPageChromeIsShown() {
    await this.waitVisible(this.byA11y(LOGIN_A11Y.logo), `${APP_BRAND_NAME} logo`);
    await this.waitForText(LOGIN_TEXT.portalName);
    await this.waitForText(LOGIN_TEXT.signInHeading);
    await this.waitVisible(this.byA11y(LOGIN_A11Y.mobileTab), 'Mobile Number tab');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.emailTab), 'Email tab');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.signUp), 'Sign up link');
    await this.waitForText(LOGIN_TEXT.noAccountPrompt);
  }

  async expectEmailFormControlsAreShown() {
    await this.waitForText(LOGIN_TEXT.emailLabel);
    await this.waitForText(LOGIN_TEXT.passwordLabel);
    await this.waitVisible(this.emailInput, 'Email input');
    await this.waitVisible(this.passwordInput, 'Password input');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.showPassword), 'Show password toggle');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.rememberMe), 'Remember me checkbox');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.forgotPassword), 'Forgot password link');
    await this.waitVisible(this.signInButton, 'Sign In button');
    await this.waitVisible(this.byA11y(LOGIN_A11Y.signUp), 'Sign up link');
  }

  async expectForgotPasswordScreenIsShown() {
    await this.waitForText(FORGOT_PASSWORD_TEXT.heading);
    await this.waitForText(FORGOT_PASSWORD_TEXT.instruction);
    await this.waitForText(FORGOT_PASSWORD_TEXT.phoneLabel);
    await this.waitForText(FORGOT_PASSWORD_TEXT.countryCode);
    await this.waitVisible(this.byA11y(FORGOT_PASSWORD_A11Y.sendOtp), 'Send OTP button');
    await this.waitVisible(
      this.byA11y(FORGOT_PASSWORD_A11Y.backToSignIn),
      'Back to Sign In link',
    );
  }

  async expectRememberMeIsChecked() {
    await d().waitUntil(async () => this.isRememberMeChecked(), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Remember me did not become checked after tapping it.',
    });
  }

  async expectRememberMeIsNotChecked() {
    await d().waitUntil(async () => !(await this.isRememberMeChecked()), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Remember me stayed checked after tapping it again.',
    });
  }

  async expectPasswordIsMasked() {
    await this.waitVisible(this.passwordInput, 'Password input');
    let masked = await this.passwordInput.getAttribute('password');
    if (masked !== 'true') {
      throw new Error(`Password field is not masked (password="${masked}").`);
    }
  }

  async expectStillOnLoginForm() {
    await this.waitForText(LOGIN_TEXT.signInHeading);
    await this.waitVisible(this.signInButton, 'Sign In button');
  }

  async expectPasswordNotVisible(plaintext: string) {
    let source = await this.decodedPageSource();
    if (source.includes(plaintext)) {
      throw new Error('The password is rendered in plain text on screen.');
    }
  }

  async expectLoginSucceeded() {
    await this.waitGone(this.continueToPortals, 'logged-out Continue button');
    await this.waitVisible(this.profileTab, 'bottom navigation');
  }

  async expectDashboardIsOpen() {
    await this.waitForText(DASHBOARD_TEXT.glanceSubheading);
  }

  // Asserts the regression too: the bare "Validation error" DEF-01 reported must stay gone.
  async expectInvalidEmailFormatError() {
    await this.waitForText(LOGIN_TEXT.invalidEmailFormat);
    if ((await this.decodedPageSource()).includes(LOGIN_TEXT.legacyValidationError)) {
      throw new Error(`The pre-fix "${LOGIN_TEXT.legacyValidationError}" message is showing again.`);
    }
  }

  async expectInvalidCredentialsError() {
    await this.waitForText(LOGIN_TEXT.invalidCredentials);
  }

  async expectSubmitIsDisabled() {
    await d().waitUntil(async () => !(await this.isSubmitEnabled()), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Sign In was enabled with an empty form.',
    });
  }

  async expectSubmitIsEnabled() {
    await d().waitUntil(async () => this.isSubmitEnabled(), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Sign In stayed disabled after both fields were filled.',
    });
  }

  async expectGreetingNames(displayName: string) {
    await this.waitForText(displayName); // not the greeting word — it varies by hour
  }
}
