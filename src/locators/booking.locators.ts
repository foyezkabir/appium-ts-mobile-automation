// Strings pinned to baselines/booking.baseline.json (2026-09-21).
// RN app: almost no resource-ids, so accessibility id is the primary handle.

export const DOCTOR_PROFILE_A11Y = {
  bookAppointment: 'Book Appointment', // sits under the nav band; reach first
  selectChamber: 'Select',
  openInMaps: 'Open in Maps', // never tapped — leaves the app
} as const;

export const DOCTOR_PROFILE_TEXT = {
  heading: 'Doctor Profile',
  selectChamber: 'Select Chamber',
  visitCharges: 'Visit Charges',
  allConsultationFees: 'All consultation fees',
  availableDay: 'Available Day',
  feeFirstVisit: 'First Visit',
  feeReportView: 'Report View',
  feeSecondVisit: '2nd Visit',
  feeAfterOneMonth: 'After 1 Month',
  bmdcPrefix: 'BMDC Reg. No:',
  experienceSuffix: 'Years of Experience',
  chamberActive: 'Active',
  feeFirstVisitHint: 'Initial consultation',
  feeReportViewHint: 'Test review',
  feeSecondVisitHint: 'Within 1 month',
  feeAfterMonthHint: 'Subsequent visit',
  currency: '৳',
} as const;

export const DATE_SHEET_A11Y = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  cancel: 'Cancel',
  continue: 'Continue',
  dismiss: 'Dismiss',
} as const;

export const DATE_SHEET_TEXT = {
  heading: 'Pick a date',
  subheading: "Choose from the doctor's available days",
} as const;

export const APPOINTMENT_TYPE = {
  inPerson: 'In-Person',
  teleconsultation: 'Teleconsultation',
  pickup: 'Pickup',
  followUp: 'Follow-up',
} as const;

// The subtitle under each appointment-type radio.
export const APPOINTMENT_TYPE_DESCRIPTION = {
  'In-Person': 'Consultation at clinic',
  Teleconsultation: 'Video session',
  Pickup: 'Prescription collection',
  'Follow-up': 'Repeat visit',
} as const;

// The calendar's month header, e.g.
export const MONTH_HEADING_PATTERN =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/;

export const DAY_SUFFIX = {
  bookable: ' left', // "22 September, 31 left"
  off: ', Off', // "23 September, Off"
} as const;

export const CONFIRM_A11Y = {
  confirmBooking: 'Confirm Booking', // irreversible
  goBack: 'Go Back',
} as const;

export const CONFIRM_TEXT = {
  heading: 'Confirm Booking',
  detailsHeading: 'Appointment Details',
  doctor: 'Doctor',
  chamber: 'Chamber',
  date: 'Date',
  session: 'Session',
  estimatedSerial: 'Estimated serial',
} as const;

export const SUCCESS_A11Y = {
  trackMyQueue: 'Track My Queue',
  viewMyAppointments: 'View My Appointments',
} as const;

export const SUCCESS_TEXT = {
  heading: 'Booking confirmed',
  estTurnTime: 'Est. turn time',
  smsNotice: 'You will receive an SMS when it is almost your turn.',
} as const;

// Which appointment-type radios a chamber enables.
export const CHAMBER_ENABLES_TYPES = {
  IN_PERSON: ['In-Person', 'Pickup', 'Follow-up'],
  TELECONSULTATION: ['Teleconsultation'],
  BOTH: ['In-Person', 'Teleconsultation', 'Pickup', 'Follow-up'],
} as const;

// The Patient Details block at the foot of the date sheet. Device-verified 2026-09-24.
export const PATIENT_DETAILS_TEXT = {
  heading: 'Patient Details',
  subheading: 'Who this appointment is for, and any notes for the doctor',
  whoFor: 'Who is this for?',
  accountHolder: 'Myself', // the SELF patient's option; family members keep their names (device-verified 2026-10-07)
  mobileLabel: 'Mobile number',
  countryCode: '+880',
  mobileLockedHint: "Used to sign in · can't be changed",
  notesLabel: 'Notes',
  notesPlaceholder: 'e.g. Hypertension follow-up; BP review and medicine renewal.',
  serialHint: 'Your exact serial will be shown after you confirm.',
} as const;

// No a11y id on either input. On the open sheet the only EditTexts are these two,
// in this order: the locked mobile number, then Notes.
export const PATIENT_DETAILS_FIELD_INDEX = {
  mobile: 0,
  notes: 1,
} as const;
