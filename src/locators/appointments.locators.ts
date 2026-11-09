// Strings pinned to baselines/appointments.baseline.json (2026-09-21).
// RN app: almost no resource-ids, so accessibility id is the primary handle.

export const APPOINTMENTS_A11Y = {
  upcomingTab: 'Upcoming',
  pastTab: 'Past',
  bookAppointment: 'Book Appointment',
} as const;

// Device-verified 2026-09-25.
export const APPOINTMENTS_TEXT = {
  heading: 'My Appointments',
  statusScheduled: 'Scheduled',
  statusCompleted: 'Completed',
  statusCancelled: 'Cancelled',
  emptyUpcoming: 'No upcoming appointments.',
} as const;

// A list row's date stamp: "26 Sep 2026 · 7:00 AM". A row for TODAY reads
// "Today, 24 Sep · 2:00 PM" instead — the seeded rows here are never today.
export const ROW_STAMP_PATTERN = /^\d{1,2} [A-Z][a-z]{2} \d{4} · \d{1,2}:\d{2} [AP]M$/;

// Either row stamp, split into day, month, year?, hour, minute, AM/PM:
// "26 Sep 2026 · 7:20 AM" or, for today, "Today, 25 Sep · 5:00 PM" (Past walk, 2026-09-25).
export const ROW_STAMP_PARTS = /^(?:Today, )?(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))? · (\d{1,2}):(\d{2}) ([AP]M)$/;

export const APPOINTMENT_ROW_PREFIX = 'Appointment with ';

// The live queue screen, reached from "Track My Queue" on the appointment detail.
export const QUEUE_TEXT = {
  heading: 'Live Queue',
  yourSerial: 'YOUR SERIAL',
  nowServing: 'Now serving',
  peopleAhead: 'People ahead',
} as const;

export const QUEUE_TOKEN_PATTERN = /T-\d+/;

export const APPOINTMENT_DETAIL_A11Y = {
  trackMyQueue: 'Track My Queue',
  cancelAppointment: 'Cancel Appointment',
  joinSession: 'Join Session',
  bookFollowUpPrefix: 'Book follow-up', // full id: "Book follow-up, Pre-fills with <doctor>"
} as const;

export const APPOINTMENT_DETAIL_TEXT = {
  reasonForVisit: 'REASON FOR VISIT', // where a booking note is shown
  quickActions: 'Quick actions', // shown on a COMPLETED appointment only
  heading: 'Appointment',
  appointmentNo: 'Appointment No.',
  dateAndTime: 'Date & Time', // arrives XML-escaped; BasePage decodes
  clinic: 'Clinic',
  inPersonVisit: 'In-Person Visit',
} as const;

// How the appointment detail chips the booked type, keyed by the type CHOSEN in the booking sheet.
export const APPOINTMENT_DETAIL_TYPE_LABEL = {
  'In-Person': 'In-Person Visit',
  Teleconsultation: 'Teleconsultation', // was "Video Visit" until the new release (device-verified 2026-10-07)
  Pickup: 'Pickup',
  'Follow-up': 'Follow-up', // exact chip text, device-verified 2026-10-07 (was "Follow-up Visit" until the new release)
} as const;


// Only shown for a teleconsultation booking.
export const TELECONSULTATION_DETAIL_TEXT = {
  linkLabel: 'Teleconsultation Link',
  joinSession: 'Join Session',
  copyLink: 'Copy Link',
} as const;

// "Join Session" always launches the link in the BROWSER; the join window is
// enforced by that page, not by the app. Device-verified 2026-09-24.
export const TELECONSULTATION_JOIN_WEB = {
  browserPackage: 'com.android.chrome',
  notActiveHeading: 'Your session link is not active yet',
  notActiveDetail:
    'This video consultation link becomes active at the start of the day of your appointment.',
  joinPath: '/teleconsult/join',
  waitingForDoctor: 'Waiting for doctor to join',
  // The detail shows a SHORTENED link (tinyurl) that redirects to joinPath.
  linkPattern: /^https?:\/\/\S+$/,
} as const;

export const BOOKING_REF_PATTERN = /BK-\d{2}-\d{4}-\d+/;

export const CANCEL_SHEET_A11Y = {
  confirmCancellation: 'Confirm cancellation',
  dismissWithoutCancelling: 'Cancel', // confusing pair — do not swap
  dismiss: 'Dismiss',
} as const;

export const CANCEL_SHEET_TEXT = {
  heading: 'Cancel this appointment?',
  warning: 'This cannot be undone. Your serial will be released to the next patient.',
} as const;
