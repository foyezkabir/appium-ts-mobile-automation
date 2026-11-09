import { APP_BRAND_NAME } from '../support/config';

// Strings pinned to baselines/auth.baseline.json (2026-09-21).
// RN app: almost no resource-ids, so accessibility id is the primary handle.

export const LOGIN_A11Y = {
  continueToPortals: 'Continue', // label differs per tab; "Sign In" on Bookings
  customerPortal: 'Customer Portal',
  logo: APP_BRAND_NAME,
  mobileTab: 'Mobile Number',
  emailTab: 'Email',
  showPassword: 'Show password',
  rememberMe: 'Remember me',
  forgotPassword: 'Forgot password',
  signIn: 'Sign In',
  signUp: 'Sign up',
  goBack: 'Go back',
} as const;

export const LOGOUT_A11Y = {
  logOut: 'Log out',
  confirmLogOut: 'Log out', // same label on the confirmation sheet
  cancel: 'Cancel',
  dismiss: 'Dismiss',
} as const;

export const LOGOUT_TEXT = {
  confirmHeading: 'Are you sure you want to log out?',
} as const;

export const LOGIN_TEXT = {
  portalChooserHeading: 'Welcome',
  portalName: 'Customer Portal',
  signInHeading: `Sign in to ${APP_BRAND_NAME}`,
  emailTabHint: 'Use your email and password (legacy).',
  signInSheetHeading: 'Sign in to continue',
  invalidCredentials: 'Invalid email or password',
  invalidEmailFormat: 'Please enter a valid email address.', // device-verified 2026-09-24, DEF-01 fix
  legacyValidationError: 'Validation error', // the pre-fix string; must never return
  emailLabel: 'Email',
  passwordLabel: 'Password',
  rememberMe: 'Remember me',
  forgotPassword: 'Forgot password?',
  noAccountPrompt: "Don't have an account?",
  signUp: 'Sign Up',
  mobileHint: 'Prefer mobile login? Switch to the Mobile Number tab — faster, no password needed.',
} as const;

export const SIGNIN_PROMPT_TEXT = {
  heading: 'Sign in to continue',
  bookings: 'Sign in to view, reschedule, and manage your doctor appointments.',
  home: 'Sign in to see your appointments, prescriptions, and personalized dashboard.',
  prescription: 'Sign in to see prescriptions given to you by your doctor.',
  profile: 'Sign in to your account, or choose a business portal to manage your pharmacy POS.',
} as const;

export const SIGNIN_PROMPT_A11Y = {
  signIn: 'Sign In', // bookings, home, prescription
  continue: 'Continue', // profile only
  signUp: 'Sign up',
} as const;

export const FORGOT_PASSWORD_A11Y = {
  sendOtp: 'Send OTP',
  backToSignIn: 'Back to Sign In',
  goBack: 'Go back',
} as const;

export const FORGOT_PASSWORD_TEXT = {
  heading: 'Forgot Password?',
  instruction: "Enter your phone number and we'll send you a 6-digit OTP to reset your password.",
  phoneLabel: 'Phone Number',
  phonePlaceholder: '01XXX-XXXXXX',
  countryCode: '+880',
  sendOtp: 'Send OTP',
  backToSignIn: 'Back to Sign In',
} as const;

export const LOGIN_FIELD_INDEX = {
  email: 0, // inputs carry no a11y id; form order is fixed
  password: 1,
} as const;

// The dashboard greeting WITH a name — "Good evening, Sam 👋" — is only
// shown signed in; signed out it reads "Good morning," with nothing after it
// (device dumps 2026-09-25).
export const SIGNED_IN_GREETING_PATTERN = /text="Good (?:morning|afternoon|evening), \S[^"]*"/;
