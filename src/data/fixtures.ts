import {
  provisionedDoctor,
  provisionedChamber,
  type ProvisionedDoctor,
  type ProvisionedChamber,
} from '../api/tenant';

export function mainDoctor(): ProvisionedDoctor {
  return provisionedDoctor('cardiologist');
}

// A doctor in a DIFFERENT speciality, so "filtering excludes others" can fail when it should.
export function otherDoctor(): ProvisionedDoctor {
  return provisionedDoctor('orthopaedic');
}

export function primaryChamber(): ProvisionedChamber {
  return provisionedChamber('cardiologist', 'primary');
}

export function alternateChamber(): ProvisionedChamber {
  let doctor = mainDoctor();
  let chamber = doctor.chambers.find((c) => c.key !== 'primary');
  if (!chamber) {
    throw new Error(
      `${doctor.fullName} has only one chamber, so chamber switching cannot be tested.`,
    );
  }
  return chamber;
}

// A non-default chamber seeded with a PARTIAL week, so the calendar's "Off" days are reachable.
export function partialWeekChamber(): ProvisionedChamber {
  let doctor = mainDoctor();
  let chamber = doctor.chambers.find(
    (c) => c.key !== 'primary' && c.daysOfWeek.length < 7,
  );
  if (!chamber) {
    throw new Error(
      `${doctor.fullName} has no non-default chamber with a partial week, so ` +
        `"Off" days are unreachable. The bootstrap should seed one.`,
    );
  }
  return chamber;
}

function chamberOfType(
  type: ProvisionedChamber['consultationType'],
): ProvisionedChamber {
  let doctor = mainDoctor();
  let chamber = doctor.chambers.find((c) => c.consultationType === type);
  if (!chamber) {
    throw new Error(
      `${doctor.fullName} has no ${type} chamber. The bootstrap should provision one of each.`,
    );
  }
  return chamber;
}

export function teleconsultationChamber(): ProvisionedChamber {
  return chamberOfType('TELECONSULTATION');
}

export function inPersonChamber(): ProvisionedChamber {
  return chamberOfType('IN_PERSON');
}

// A chamber accepting BOTH — the only one where all four appointment-type radios are enabled.
export function hybridChamber(): ProvisionedChamber {
  return chamberOfType('BOTH');
}

export function prescribingDoctor(): ProvisionedDoctor {
  return mainDoctor();
}

export function searchTerms() {
  let doctor = mainDoctor();
  let other = otherDoctor();
  let surname = doctor.fullName.split(' ').slice(-1)[0];

  return {
    // A real substring of a real doctor's name.
    partialName: surname,
    fullName: doctor.fullName,
    speciality: doctor.primarySpeciality,
    // The tenant stores specialities capitalised; a lowercase query must still match, or a user typing naturally sees an empty list.
    lowercaseName: surname.toLowerCase(), // case-insensitivity on the NAME
    lowercase: doctor.primarySpeciality.toLowerCase(),
    // What a paste produces.
    padded: `  ${surname}  `,
    // A speciality that is NOT the main doctor's, for exclusion assertions.
    otherSpeciality: other.primarySpeciality,
    // Randomised per run so it can never start matching seeded data.
    noMatch: () => `ZZQQ${Date.now().toString().slice(-6)}`,
  };
}

export function filterSpecialities() {
  return {
    main: mainDoctor().primarySpeciality,
    other: otherDoctor().primarySpeciality,
  };
}

export function filterLocation() {
  return { division: 'Dhaka', district: 'Dhaka' };
}

// "MONDAY" -> "Monday": the seed stores upper case, the app renders title case.
export function weekdayLabels(days: string[]): string[] {
  return days.map((d) => d.charAt(0) + d.slice(1).toLowerCase());
}

// "07:00:00","09:00:00" -> "7:00 AM – 9:00 AM" (en dash, as the app renders it).
export function sessionHours(start: string, end: string): string {
  return `${clockLabel(start)} – ${clockLabel(end)}`;
}

function clockLabel(time: string): string {
  let [rawHour, minute] = time.split(':');
  let hour = Number(rawHour);
  let suffix = hour >= 12 ? 'PM' : 'AM';
  let display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}
