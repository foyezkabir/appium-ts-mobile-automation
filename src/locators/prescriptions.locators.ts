// Strings pinned to baselines/prescriptions.baseline.json (device crawl 2026-09-29).
// RN app: no resource-ids on these screens, so accessibility id and visible text are the handles.

export const PRESCRIPTIONS_TEXT = {
  listHeading: 'My Prescriptions',
  searchHint: 'Search by Rx#, doctor, or medicine...', // the list's only EditText; the hint doubles as its handle while empty
  countSuffixOne: 'prescription', // "1 prescription"
  countSuffixMany: 'prescriptions', // "3 prescriptions"
  noMatchHeading: 'No matching prescriptions',
  noMatchBody: 'Try a different Rx number, doctor, or medicine name.',
  sortSheetHeading: 'Sort by',
  sortMostRecent: 'Most recent',
  sortOldestFirst: 'Oldest first',
  statusActive: 'Active',
  followUpChip: 'Follow Up',
  detailHeading: 'Prescription',
  medicinesHeading: 'Prescribed Medicines',
  issuedLabel: 'ISSUED',
  patientLabel: 'PATIENT',
  notesHeading: "Doctor's Notes",
  shortNotesLabel: 'SHORT NOTES',
  followUpLabel: 'FOLLOW-UP',
  followUpPrefix: 'Follow-up recommended on ', // + "30 Sep 2026, 2:07 PM."
  consultationPrefix: 'From consultation on ', // + "29 Sep 2026" — the day it was completed
  medicinesPrescribedSuffix: 'medicines prescribed', // "5 medicines prescribed" under a multi-line table [2026-09-29]
} as const;

export const PRESCRIPTIONS_A11Y = {
  /** rung 1 a11y-id. The card is one Button; its text children carry the date, chips, Rx and doctor. [2026-09-29] */
  cardPrefix: 'Prescription ', // + rxNumber
  /** rung 1 a11y-id; node text "Most recent" / "Oldest first" shows the current choice. [2026-09-29] */
  sort: 'Sort prescriptions',
  /** rung 1 a11y-id; the sheet's options carry their label as content-desc too. [2026-09-29] */
  sortMostRecent: 'Most recent',
  sortOldestFirst: 'Oldest first',
  /** rung 1 a11y-id on the detail screen's back arrow. [2026-09-29] */
  back: 'Go back',
} as const;

// A medicine row on the detail screen is ONE ViewGroup whose content-desc
// carries every column, including those only reachable by swiping the table:
// "Napa. 500mg. Dose 1 tablet · Twice daily · 5 days. Schedule -. Duration 5 days. Instructions After meal"
export const MEDICINE_ROW = {
  dose: 'Dose ',
  schedule: 'Schedule ',
  duration: 'Duration ',
  instructions: 'Instructions ',
} as const;

// The detail header summary: "1 medicine · Issued 23 Sep 2026 · Expires 23 Oct 2026".
export const DETAIL_SUMMARY = {
  medicineOne: 'medicine',
  medicineMany: 'medicines',
  issued: 'Issued ',
  expires: 'Expires ',
} as const;

// "Sam Carter · Male · 30 yrs · O+"
export const PATIENT_GENDER_LABEL = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
} as const;

export const RX_NUMBER_PATTERN = /RX-\d+-\d+/;
