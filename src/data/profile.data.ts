import { DataHelper } from './DataHelper';
import { BLOOD_GROUPS, CONDITIONS } from '../locators/profile.locators';
import type { CustomerProfile } from '../api/client';

export type Gender = CustomerProfile['gender'];
export type Condition = (typeof CONDITIONS)[number];

// Every editable field except email and password.
export type ProfileEdits = {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  bloodGroup: string;
  address: string;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  emergencyName: string;
  emergencyPhone: string; // local format, 01XXXXXXXXX
};

// Input the app stores, so generated. Realistic: this is a production account.
const ALLERGENS = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Ibuprofen', 'Peanuts', 'Shellfish', 'Latex', 'Dust mites'];

// New values for every field, each DIFFERENT from what the account holds now —
// an edit that happens to equal the old value would pass without saving anything.
export function profileEdits(current: CustomerProfile): ProfileEdits {
  let genders: Gender[] = ['MALE', 'FEMALE', 'OTHER'];
  return {
    firstName: DataHelper.firstName(),
    lastName: DataHelper.lastName(),
    // The birthday EDGE: the 30th birthday is TOMORROW, so the dashboard must
    // read 29 yrs — one date proves both "DOB reaches the dashboard" and the
    // off-by-one a naive year subtraction gets wrong.
    dateOfBirth: birthdays(30).tomorrow,
    bloodGroup: DataHelper.pick(BLOOD_GROUPS.filter((g) => g !== current.bloodGroup)),
    address: DataHelper.address(),
    gender: DataHelper.pick(genders.filter((g) => g !== current.gender)),
    heightCm: Math.round(DataHelper.decimal(150, 190)), // whole cm, as the account holds it
    weightKg: DataHelper.decimal(50, 95),
    emergencyName: DataHelper.firstName() + ' ' + DataHelper.lastName(),
    emergencyPhone: DataHelper.phone(),
  };
}

const CUSTOM_CONDITIONS = ['Migraine', 'Gout', 'Psoriasis', 'Osteoarthritis'];

// Two allergies and two conditions to add, one of each to remove, and a custom
// condition for Others — with what the dashboard tiles must read after each save.
export function healthListEdits(current: CustomerProfile) {
  let allergies = DataHelper.pickSome(ALLERGENS.filter((a) => !current.knownAllergies.includes(a)), 2);
  let conditions = DataHelper.pickSome(CONDITIONS.filter((c) => !current.chronicConditions.includes(c.name)), 2)
    .sort((a, b) => CONDITIONS.indexOf(a) - CONDITIONS.indexOf(b));
  let custom = DataHelper.pick(CUSTOM_CONDITIONS);
  let kept = { allergies: [...current.knownAllergies, allergies[0]], conditions: [...current.chronicConditions, conditions[0].name] };
  return {
    allergies,
    conditions,
    custom,
    tiles: {
      added: { allergies: [...current.knownAllergies, ...allergies], conditions: [...current.chronicConditions, ...conditions.map((c) => c.name)] },
      afterRemoval: kept,
      withCustom: { allergies: kept.allergies, conditions: [...kept.conditions, custom] },
    },
  };
}

// Values whose SHAPE is the test, so fixed. Each message was observed on the device.
export function invalidProfile() {
  let nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return {
    futureDateOfBirth: nextYear,
    emergencyPhone: '12345',
    weightTooHigh: '999',
    heightTooLow: '20',
    heightTooHigh: '300',
  };
}

// The new password is generated: a fixed one on production could one day be
// someone's real password. The short one is too short to ever be accepted.
export function passwordEdits() {
  return {
    tooShort: 'abc12',
    wrongCurrent: DataHelper.password(),
    temporary: DataHelper.password(),
  };
}

// An allergy added OUTSIDE the app, for the stale-form defect.
export function outsideAllergy(current: CustomerProfile): string {
  return DataHelper.pick(ALLERGENS.filter((a) => !current.knownAllergies.includes(a)));
}

// Dates of birth for the age boundary, typed through Edit Profile: the
// `years`th birthday falls TODAY, or TOMORROW (one day short of it).
export function birthdays(years: number) {
  let today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let before = (at: Date) => new Date(at.getFullYear() - years, at.getMonth(), at.getDate());
  return { years, today: before(today), tomorrow: before(tomorrow) };
}
