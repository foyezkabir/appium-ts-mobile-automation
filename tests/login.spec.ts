import { useLogin } from '../src/support/login.fixture';

describe('Login — email and password', () => {
  let fx = useLogin();

  test('TC-01: Verify that the email login form is reachable and shows its fields', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.expectEmailFormIsOpen();
  });

  test('TC-02: Verify that the login page has logo, portal name, heading of sign in, mobile number tab, email tab, link and sign up link', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.expectLoginPageChromeIsShown();
  });

  test('TC-03: Verify that the email login page has email, password fields, login button, forgot password link and sign up link', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.expectEmailFormControlsAreShown();
  });

  test('TC-04: Verify that the logged-out sign in prompt shows the right content and action on every tab', async () => {
    await fx.login.expectBookingsTabPromptsSignIn();
    await fx.login.expectHomeTabPromptsSignIn();
    await fx.login.expectPrescriptionTabPromptsSignIn();
    await fx.login.expectProfileTabPromptsContinue();
    await fx.login.expectSearchTabHasNoSignInPrompt();
  });

  test('TC-05: Verify that the sign in button stays disabled for blank input and enables once real characters are entered', async () => {
    await fx.login.fillSignInForm(fx.creds.spaceEmail, fx.creds.spacePassword);
    await fx.login.expectSubmitIsDisabled(); // email is trimmed, so it reads as empty

    await fx.login.enterCredentials(fx.creds.validEmail, fx.creds.validPassword);
    await fx.login.expectSubmitIsEnabled();
  });

  test('TC-06: Verify that the sign in button is not clickable when the email field is blank and password is valid', async () => {
    await fx.login.fillSignInForm(fx.creds.spaceEmail, fx.creds.validPassword);
    await fx.login.expectSubmitIsDisabled();
  });

  test('TC-07: Verify that the sign in button becomes clickable when the password field has a space, as spaces are valid password characters', async () => {
    await fx.login.fillSignInForm(fx.creds.validEmail, fx.creds.spacePassword);
    await fx.login.expectSubmitIsEnabled();
  });

  test('TC-08: Verify that the error message is displayed when the user tries to log in with an invalid email format', async () => {
    await fx.login.signInWith(fx.creds.malformedEmail, fx.creds.validPassword);
    await fx.login.expectInvalidEmailFormatError();
  });

  test('TC-09: Verify that login with invalid email and valid password is rejected', async () => {
    await fx.login.signInWith(fx.creds.unknownEmail, fx.creds.validPassword);
    await fx.login.expectInvalidCredentialsError();
  });

  test('TC-10: Verify that login with valid email and invalid password is rejected', async () => {
    await fx.login.signInWith(fx.creds.validEmail, fx.creds.wrongPassword);
    await fx.login.expectInvalidCredentialsError();
  });

  test('TC-11: Verify that an over-length email is rejected and does not sign the user in', async () => {
    await fx.login.signInWith(fx.creds.longEmail, fx.creds.validPassword);
    await fx.login.expectStillOnLoginForm(); // API answers 400, not 401
  });

  test('TC-12: Verify that an over-length password is rejected and does not sign the user in', async () => {
    await fx.login.signInWith(fx.creds.validEmail, fx.creds.longPassword);
    await fx.login.expectStillOnLoginForm();
  });

  test('TC-13: Verify that the password field masks the entered password', async () => {
    await fx.login.fillSignInForm(fx.creds.validEmail, fx.creds.validPassword);
    await fx.login.expectPasswordIsMasked();
    await fx.login.expectPasswordNotVisible(fx.creds.validPassword);
  });

  test('TC-14: Verify that the forgot password link opens the reset screen with phone number entry', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.openForgotPassword();
    await fx.login.expectForgotPasswordScreenIsShown();
    await fx.login.backToSignInFromForgotPassword();
  });

  test('TC-15: Verify that the remember me checkbox can be ticked and unticked', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.tickRememberMe();
    await fx.login.expectRememberMeIsChecked();
    await fx.login.untickRememberMe();
    await fx.login.expectRememberMeIsNotChecked();
  });

  test('TC-16: Verify that leading and trailing spaces in a valid email are handled correctly', async () => {
    await fx.login.signInWith(fx.creds.paddedEmail, fx.creds.validPassword);
    await fx.login.expectLoginSucceeded();
    await fx.login.logOutIfLoggedIn(); // leave logged out for TC-17
  });

  test('TC-17: Verify that the user can log in successfully after relaunching the app', async () => {
    await fx.login.openEmailLoginForm();
    await fx.login.restartApp(); // native equivalent of a page refresh
    await fx.login.returnToTabRoute();

    await fx.login.signInWith(fx.creds.validEmail, fx.creds.validPassword);
    await fx.login.expectLoginSucceeded();
    await fx.login.logOutIfLoggedIn(); // leave logged out for TC-18
  });

  test('TC-18: Verify that all upper case email is accepted and not marking as invalid', async () => {
    await fx.login.signInWith(fx.creds.uppercaseEmail, fx.creds.validPassword);
    await fx.login.expectLoginSucceeded();
    await fx.login.logOutIfLoggedIn(); // leave logged out for TC-19
  });

  test('TC-19: Verify that the user can log in with valid email and password, with remember me ticked, and is directed to the dashboard', async () => {
    await fx.login.fillSignInForm(fx.creds.validEmail, fx.creds.validPassword);
    await fx.login.tickRememberMe();
    await fx.login.submit();
    await fx.login.expectLoginSucceeded();
    await fx.nav.goHome();
    await fx.login.expectDashboardIsOpen();
    await fx.login.expectGreetingNames(fx.displayName);
    await fx.nav.expectNavIsVisible();
  });

  test('TC-20: Verify that a returning user stays signed in and lands on the dashboard after relaunching the app', async () => {
    await fx.login.restartApp(); // session must survive a cold start
    await fx.login.expectLoginSucceeded();
    await fx.nav.goHome();
    await fx.login.expectDashboardIsOpen();
    await fx.login.expectGreetingNames(fx.displayName);
  });
});
