// Strings pinned to baselines/dashboard.baseline.json (2026-09-21).
// RN app: almost no resource-ids, so accessibility id is the primary handle.

export const DASHBOARD_A11Y = {
  bookAppointment: 'Book Appointment',
  seeAllNeedsAttention: 'See all Needs Your Attention',
  viewDetails: 'View Details',
} as const;

export const DASHBOARD_TEXT = {
  glanceSubheading: "Here's your health at a glance",
  needsAttention: 'Needs Your Attention',
  bloodGroup: 'Blood Group',
  age: 'Age',
  knownAllergies: 'Known Allergies',
  chronicCondition: 'Chronic Condition',
  ageSuffix: 'yrs',
  dobPrefix: 'DOB ·',
  prescriptionsHeading: 'My Prescriptions', // where the Prescription tile lands
} as const;

export const DASHBOARD_A11Y_PREFIX = {
  prescriptionCard: 'Prescription,', // full id embeds a live count
  appointmentCard: 'Appointment,',
} as const;

// The tiles' full a11y ids, e.g. "Appointment, 1 upcoming" (crawl 2026-09-25).
export const DASHBOARD_TILE_SUFFIX = {
  prescription: 'saved',
  appointment: 'upcoming',
} as const;
