// Strings pinned to baselines/profile.baseline.json (device crawl 2026-09-25).
// RN app: almost no resource-ids, so accessibility id and visible text are the handles.
// My Profile stays MOUNTED under Edit Profile, and both show "78.9", a date and
// radios — editable fields are therefore matched as CLICKABLE EditTexts only.

export const PROFILE_TEXT = {
  heading: 'My Profile',
  bloodGroup: 'Blood Group', // the log-out path scrolls to it
  editHeading: 'Edit Profile',
  savedToast: 'Profile updated',
  savedToastBody: 'Your changes have been saved.',
  bmiUnit: 'kg/m²',
  noneKnown: 'None known',
  photoUploadFailed: "Couldn't upload photo. Try again.",
  // The inline banner under Change Photo, device-verified 2026-10-07 for a 1024×1024 photo; {size} is "<width>×<height>".
  photoWrongType: "This file type isn't supported. Please choose a JPG or PNG photo.", // device-verified 2026-10-07 for WebP
  photoTooLarge: 'This photo is {size} px. Please choose one that is 512×512 px or smaller.',
} as const;

// Field labels on Edit Profile — the anchor each editable field is found under.
export const EDIT_LABEL = {
  firstName: 'First name *',
  lastName: 'Last name *',
  mobile: 'Mobile number',
  dateOfBirth: 'Date of birth *',
  address: 'Address',
  gender: 'Gender',
  height: 'Height (cm)',
  weight: 'Weight (kg)',
  emergencyName: 'Emergency Contact Name',
  emergencyPhone: 'Emergency Contact Phone',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
} as const;

// Placeholders the empty fields show.
export const EDIT_HINT = {
  address: 'House, road, area, city',
  emergencyName: 'e.g. Karim Ahmed',
  emergencyPhone: '1XXX-XXXXXX',
  allergen: 'Type an allergen...',
  customCondition: 'Comma Separated', // enabled once Others is ticked; holds ALL custom conditions, comma-separated
  customConditionSubmit: 'Enter ⏎', // the hint under the box — it commits on the keyboard's Enter
  currentPassword: 'Enter your current password',
  newPassword: 'At least 8 characters',
} as const;

// The DOB field shows "16 / 11 / 1999"; tapping it CLEARS it to this and opens
// a number pad, so the digits are typed into the focused field.
// Character classes, not \\d: a backslash is double-escaped on its way into UiAutomator and matches nothing.
export const DOB_FIELD_PATTERN = '[0-9]{2} / [0-9]{2} / [0-9]{4}|DD / MM / YYYY';

// Read-only labels on My Profile.
export const VIEW_LABEL = {
  dateOfBirth: 'Date of Birth',
  address: 'Address',
  emergencyName: 'Emergency Contact Name',
  emergencyPhone: 'Emergency Contact Phone',
  mobileLockedNote: "Used to sign in · can't be changed",
} as const;

export const PROFILE_A11Y = {
  editProfile: 'Edit Profile',
  saveChanges: 'Save Changes',
  cancel: 'Cancel',
  personalTab: 'Personal Information',
  allergiesTab: 'Allergies & Conditions', // a PREFIX: with entries it reads "Allergies & Conditions, 2"
  removeChipPrefix: 'Remove ', // each allergy / condition chip: "Remove Penicillin"
  othersCondition: 'Others, Add a condition not listed',
  bloodGroup: 'Blood Group',
  addAllergy: '+ Add',
  keypadDone: 'Done',
  changePhoto: 'Change photo',
  changePassword: 'Change password',
  logOut: 'Log out',
} as const;

export const GENDER_A11Y = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' } as const;

// The blood-group sheet, in the app's order.
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// "Common conditions in Bangladesh" — each checkbox's a11y id is "<name>, <description>".
export const CONDITIONS = [
  { name: 'Type 2 Diabetes', a11y: 'Type 2 Diabetes, High blood sugar' },
  { name: 'Pre-diabetes', a11y: 'Pre-diabetes, Elevated blood sugar, not yet diabetic' },
  { name: 'Hypertension', a11y: 'Hypertension, High blood pressure' },
  { name: 'Heart Disease', a11y: 'Heart Disease, Coronary artery disease, arrhythmia' },
  { name: 'Asthma', a11y: 'Asthma, Chronic respiratory condition' },
  { name: 'Thyroid Disorder', a11y: 'Thyroid Disorder, Hypo / hyperthyroidism' },
] as const;

// Validation copy, each observed on the device.
export const VALIDATION_TEXT = {
  firstNameRequired: 'First name is required.',
  dobInFuture: 'Date of birth must be in the past.', // device-verified 2026-10-07
  phoneInvalid: 'Invalid phone number. Please check and try again.',
  weightTooLow: 'Weight must be at least 1 kg',
  weightTooHigh: 'Weight must be at most 500 kg',
  heightTooLow: 'Height must be at least 30 cm',
  passwordTooShort: 'Password must be 8–72 characters.', // device-verified 2026-10-07
  currentPasswordWrong: 'Current password is incorrect',
} as const;

// The Android system photo picker. The app's crop screen is gone: a photo is checked and uploaded straight after Done.
export const PHOTO_PICKER = {
  itemPrefix: 'Photo taken on',
  done: 'Done',
} as const;
