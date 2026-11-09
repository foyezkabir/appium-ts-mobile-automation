import { TENANT_EMAIL_DOMAIN, TENANT_SEED_PASSWORD } from '../support/config';

export type ChamberSeed = {
    key: 'primary' | 'teleconsultation' | 'secondary' | 'hybrid';
  name: string;
  address: string;
  phone: string;
  // The API accepts exactly these three — verified 2026-09-24 from its own rejection: "consultationType must be IN_PERSON, TELECONSULTATION, or BOTH".
  consultationType: 'IN_PERSON' | 'TELECONSULTATION' | 'BOTH';
  // Fees in BDT, in the range the tenant's real chambers charge.
  fees: {
    feeFirstVisit: number;
    feeReportView: number;
    feeSecondVisitWithinMonth: number;
    feeSecondVisitAfterMonth: number;
  };
    daysOfWeek: string[];
  sessionName: string;
  sessionStart: string;
  sessionEnd: string;
  avgConsultationTime: number;
};

export type DoctorSeed = {
  // Stable handle the suite resolves fixtures by — never a display name.
  key: 'cardiologist' | 'orthopaedic';
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  // Exactly 6 digits — the API rejects anything else with VALIDATION_ERROR.
  bmdcRegNo: string;
  primarySpeciality: string;
  additionalSpecialities: string[];
  designation: string;
  formerPosition: string;
  degrees: string;
  qualifications: string[];
  experienceYears: number;
  attachedHospital: string;
    photoUrl: string;
  chambers: ChamberSeed[];
};

export const primaryDoctorSeed: DoctorSeed = {
  key: 'cardiologist',
  firstName: 'Ashraful',
  lastName: 'Alam',
  gender: 'MALE',
  bmdcRegNo: '146028',
  primarySpeciality: 'Cardiology',
  additionalSpecialities: ['Interventional Cardiology', 'Echocardiography'],
  designation: 'Senior Consultant, Cardiology',
  formerPosition:
    'Associate Professor, Department of Cardiology, National Institute of Cardiovascular Diseases (NICVD), Dhaka',
  degrees: 'MBBS, FCPS (Medicine), MD (Cardiology)',
  qualifications: ['MBBS', 'FCPS (Medicine)', 'MD (Cardiology)'],
  experienceYears: 17,
  attachedHospital: 'National Institute of Cardiovascular Diseases (NICVD), Dhaka',
  photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  chambers: [
    {
      key: 'primary',
      name: 'Alam Heart Care, Dhanmondi Chamber',
      address: 'House 42, Road 27, Dhanmondi, Dhaka 1209',
      phone: '01711234567',
      consultationType: 'IN_PERSON',
      fees: {
        feeFirstVisit: 1500,
        feeReportView: 800,
        feeSecondVisitWithinMonth: 1000,
        feeSecondVisitAfterMonth: 1500,
      },
      // Every day, so a bookable slot is always findable for the happy path.
      //
      // The HOURS matter as much as the days: the API enforces
      // 409 SCHEDULE_DUPLICATE — "This doctor is already scheduled at another
      // chamber on <DAY> during these hours" — so a doctor's chambers must not
      // overlap in time. That is real-world correct (a consultant cannot sit in
      // two places at once), and it is why each chamber below owns a distinct
      // slice of the day.
      daysOfWeek: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ],
      sessionName: 'Evening Chamber',
      sessionStart: '17:00:00',
      sessionEnd: '22:00:00',
      avgConsultationTime: 15,
    },
    {
      key: 'teleconsultation',
      name: 'Alam Heart Care, Online Consultation',
      address: 'Online',
      phone: '01711234568',
      consultationType: 'TELECONSULTATION',
      fees: {
        feeFirstVisit: 1000,
        feeReportView: 600,
        feeSecondVisitWithinMonth: 700,
        feeSecondVisitAfterMonth: 1000,
      },
      daysOfWeek: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ],
      // Early-morning online slot — does not overlap the evening chamber.
      sessionName: 'Online Session',
      sessionStart: '07:00:00',
      sessionEnd: '09:00:00',
      avgConsultationTime: 10,
    },
    {
      key: 'secondary',
      // A PARTIAL week on purpose — this is the chamber whose calendar shows
      // "Off" days, which the day-picker assertions need.
      name: 'United Hospital Limited, Gulshan Chamber',
      address: 'Plot 15, Road 71, Gulshan, Dhaka 1212',
      phone: '01711234569',
      consultationType: 'IN_PERSON',
      fees: {
        feeFirstVisit: 2000,
        feeReportView: 1000,
        feeSecondVisitWithinMonth: 1200,
        feeSecondVisitAfterMonth: 2000,
      },
      daysOfWeek: ['SATURDAY', 'MONDAY', 'WEDNESDAY'],
      sessionName: 'Morning Chamber',
      sessionStart: '10:00:00',
      sessionEnd: '13:00:00',
      avgConsultationTime: 20,
    },
    {
      key: 'hybrid',
      // A BOTH chamber, so the state where ALL FOUR appointment-type radios are
      // enabled is reachable. Without one, that gating rule cannot be tested.
      name: 'Alam Heart Care, Uttara Chamber',
      address: 'House 9, Sector 4, Uttara, Dhaka 1230',
      phone: '01711234570',
      consultationType: 'BOTH',
      fees: {
        feeFirstVisit: 1800,
        feeReportView: 900,
        feeSecondVisitWithinMonth: 1100,
        feeSecondVisitAfterMonth: 1800,
      },
      daysOfWeek: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ],
      // Afternoon — the one window the other three chambers leave free
      // (07:00-09:00 online, 10:00-13:00 Gulshan, 17:00-22:00 Dhanmondi).
      // Overlapping any of them returns 409 SCHEDULE_DUPLICATE.
      sessionName: 'Afternoon Chamber',
      sessionStart: '14:00:00',
      sessionEnd: '16:00:00',
      avgConsultationTime: 15,
    },
  ],
};

export const secondaryDoctorSeed: DoctorSeed = {
  key: 'orthopaedic',
  firstName: 'Nusrat',
  lastName: 'Jahan',
  gender: 'FEMALE',
  bmdcRegNo: '152947',
  primarySpeciality: 'Orthopaedics',
  additionalSpecialities: ['Joint Replacement', 'Spine Surgery'],
  designation: 'Consultant, Orthopaedic Surgery',
  formerPosition:
    'Registrar, Department of Orthopaedic Surgery, National Institute of Traumatology and Orthopaedic Rehabilitation (NITOR), Dhaka',
  degrees: 'MBBS, MS (Orthopaedics)',
  qualifications: ['MBBS', 'MS (Orthopaedics)'],
  experienceYears: 11,
  attachedHospital: 'Square Hospitals Limited, Panthapath, Dhaka',
  photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
  chambers: [
    {
      key: 'primary',
      name: 'Jahan Orthopaedic Centre, Panthapath Chamber',
      address: '18/F Bir Uttam Qazi Nuruzzaman Road, Panthapath, Dhaka 1205',
      phone: '01811234567',
      consultationType: 'IN_PERSON',
      fees: {
        feeFirstVisit: 1200,
        feeReportView: 600,
        feeSecondVisitWithinMonth: 800,
        feeSecondVisitAfterMonth: 1200,
      },
      daysOfWeek: ['SUNDAY', 'TUESDAY', 'THURSDAY'],
      sessionName: 'Day Chamber',
      sessionStart: '09:00:00',
      sessionEnd: '17:00:00',
      avgConsultationTime: 15,
    },
  ],
};

export const doctorSeeds = [primaryDoctorSeed, secondaryDoctorSeed] as const;

export function doctorEmail(seed: DoctorSeed): string {
  return `dr.${seed.firstName}.${seed.lastName}`.toLowerCase() + `@${TENANT_EMAIL_DOMAIN}`;
}

// One password for every provisioned doctor account.
export const DOCTOR_PASSWORD = TENANT_SEED_PASSWORD;
