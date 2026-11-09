import { APPOINTMENT_TYPE } from '../locators/booking.locators';
import { credentials } from '../support/config';
import { DataHelper } from './DataHelper';

export type AppointmentType = (typeof APPOINTMENT_TYPE)[keyof typeof APPOINTMENT_TYPE];

export const appointmentTypes = {
  inPerson: APPOINTMENT_TYPE.inPerson,
  teleconsultation: APPOINTMENT_TYPE.teleconsultation,
  pickup: APPOINTMENT_TYPE.pickup,
  followUp: APPOINTMENT_TYPE.followUp,
} as const;

// The signed-in QA account's email, read from the environment (APP_EMAIL).
export const account = {
  get email() {
    return credentials().email;
  },
};

export const loginCredentials = () => {
  let { email, password } = credentials();
  return {
    validEmail: email,
    validPassword: password,
    uppercaseEmail: email.toUpperCase(),
    paddedEmail: `  ${email}  `, // must be trimmed before authenticating
    spaceEmail: ' ', // email IS trimmed, so this reads as empty
    spacePassword: ' ', // password is NOT trimmed — a space is a valid character
    leadingSpacePassword: ` ${password}`, // a space is only invalid at the start
    malformedEmail: 'invalid-email-format', // fixed: the SHAPE is what is tested
    // Generated, not literal. These run against PRODUCTION: a hardcoded address
    // can be registered by someone one day, and a hardcoded password can become
    // a real one — either turns "rejected" into a silent pass.
    unknownEmail: DataHelper.email('example.test'), // well-formed, no account
    wrongPassword: `No${DataHelper.uid()}!`,
    longEmail: `${'a'.repeat(250)}@example.test`, // fixed: a boundary length
    longPassword: 'X'.repeat(300), // fixed: a boundary length
  };
};

// Free text saved on PRODUCTION, so it is namespaced QA-AUTO and unique per run.
export const visitNote = () => DataHelper.unique('Visit reason');
