// Strings pinned to baselines/search.baseline.json (2026-09-21).
// RN app: almost no resource-ids, so accessibility id is the primary handle.

export const SELECT_DOCTOR_A11Y = {
  filters: 'Filters',
  allSpecialities: 'All',
  applyFilters: 'Apply Filters',
  resetFilters: 'Reset',
  dismissSheet: 'Dismiss',
} as const;

export const FILTER_LOCATION_A11Y = {
  division: 'Division',
  district: 'District',
  thana: 'Thana',
} as const;

export const FILTER_LOCATION_TEXT = {
  sectionHeading: 'Location',
  divisionLabel: 'Division',
  districtLabel: 'District',
  selectDivision: 'Select division',
  selectDistrict: 'Select district',
  districtHint: 'Choose a district to reveal Thana.',
} as const;

export const SELECT_DOCTOR_TEXT = {
  heading: 'Select doctor',
  subheading: 'Choose the doctor for this consultation',
  noResults: 'No doctors found.',
  searchPlaceholder: 'Search by doctor name', // device-verified 2026-09-24, after the DEF-03 fix
} as const;

export const SELECT_DOCTOR_FIELD_INDEX = {
  search: 0, // only EditText on the screen
} as const;

export const DOCTOR_CARD_A11Y_SEPARATOR = ', '; // card id is "<name>, <speciality>"
