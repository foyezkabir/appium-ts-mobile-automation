import { DataHelper } from './DataHelper';
import type { MedicineSchedule } from '../api/doctor';

// What the doctor writes. Brands, strengths and forms are real catalogue rows
// (GET /master-data/medicines/search, 2026-09-29), resolved to a productId at
// run time — never pinned by id, since a wiped database would orphan it.
export type PrescribedMedicine = MedicineSchedule & {
  brand: string;
  strength: string;
  dosageForm: string; // prefix: the catalogue says "Capsule (Enteric Coated)"
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  // What the detail table shows for this line (device, 2026-09-29): DOSE is
  // the full text the server builds from the schedule fields, SCHEDULE is the
  // day pattern alone, and a continuous course reads "Ongoing".
  // `instructions` is the OLD free-text field: the doctor portal no longer writes
  // it, and the app shows the doctor's current food relation in its place, falling
  // back to the old text only when no food relation is set (dev decision, PHAR-1489
  // PRESC-N1: "not a bug"; the web customer portal does the same).
  shows: { dose: string; schedule: string; duration: string; instructions: string };
};

// One line per schedule shape the API accepts, so one detail screen covers them all.
export const issuedMedicines: PrescribedMedicine[] = [
  {
    brand: 'Napa', strength: '500 mg', dosageForm: 'Tablet',
    dose: '1 tablet', frequency: 'Every day', duration: '5 days', instructions: 'After meal',
    slotMorning: 1, slotNoon: 0, slotNight: 1, dayPattern: 'EVERY_DAY', durationValue: 5, durationUnit: 'DAY', foodRelation: 'AFTER_MEAL',
    shows: { dose: '1+0+1 · after meal · 5 days', schedule: 'Every day', duration: '5 days', instructions: 'After meal' },
  },
  {
    brand: 'Seclo', strength: '20 mg', dosageForm: 'Capsule',
    dose: '1 capsule', frequency: 'Every 3 days', duration: '2 weeks', instructions: 'Before breakfast',
    slotMorning: 1, slotNoon: 0, slotNight: 0, dayPattern: 'EVERY_N_DAYS', repeatEveryDays: 3, durationValue: 2, durationUnit: 'WEEK', foodRelation: 'BEFORE_MEAL',
    shows: { dose: '1+0+0 · every 3 days · before meal · 2 weeks', schedule: 'Every 3 days', duration: '2 weeks', instructions: 'Before meal' }, // food relation wins over the legacy "Before breakfast"
  },
  {
    brand: 'Ecosprin', strength: '75 mg', dosageForm: 'Tablet',
    dose: '1 tablet', frequency: 'Mon, Wed, Fri', duration: 'Continue', instructions: 'After dinner',
    slotMorning: 0, slotNoon: 0, slotNight: 1, dayPattern: 'WEEKDAYS', weekdays: 21, continuous: true,
    shows: { dose: '0+0+1 · Mon, Wed, Fri · continue', schedule: 'Mon, Wed, Fri', duration: 'Ongoing', instructions: 'After dinner' },
  },
  {
    brand: 'Montair', strength: '10 mg', dosageForm: 'Tablet',
    dose: '1 tablet', frequency: 'Alternate days', duration: '1 month', instructions: 'At bedtime',
    slotMorning: 1, slotNoon: 0, slotNight: 0, dayPattern: 'DAYS_ON_OFF', daysOn: 1, daysOff: 1, durationValue: 1, durationUnit: 'MONTH',
    shows: { dose: '1+0+0 · 1 on · 1 off · 1 month', schedule: '1 on · 1 off', duration: '1 month', instructions: 'At bedtime' },
  },
  {
    brand: 'Fexo', strength: '180 mg', dosageForm: 'Tablet',
    dose: '1 tablet', frequency: 'Every 8 hours', duration: '3 days', instructions: 'With water',
    frequencyCode: 'EVERY_N_HOURS', intervalHours: 8, durationValue: 3, durationUnit: 'DAY',
    shows: { dose: 'every 8 hours · 3 days', schedule: 'Every day', duration: '3 days', instructions: 'With water' }, // an hourly course runs every day; the app showed "-" before the 2026-10 release
  },
];

export const issuedNotes = 'Blood pressure well controlled. Continue the current medicines and review in one week.';

// The draft a doctor has started and not finalised. Its content does not
// matter to the patient — it must never reach them.
export const draftMedicines: PrescribedMedicine[] = [issuedMedicines[0]];
export const draftNotes = 'Consultation in progress — prescription not yet finalised.';

// Days until the follow-up the issued prescription requests.
export const followUpInDays = 7;

// A search term no Rx number, doctor or medicine can contain — generated, so a
// future medicine or doctor can never turn "no match" into a silent pass.
export function searchNoMatch(): string {
  return `QA-AUTO ${DataHelper.uid()}`;
}
