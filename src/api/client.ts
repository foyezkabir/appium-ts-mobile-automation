import { API_BASE_URL, credentials } from '../support/config';
import { localDate } from '../support/dates';

// Customer-portal API client — PRECONDITIONS AND TEARDOWN ONLY.

// The envelope every endpoint returns.
type Envelope<T> = {
  status: number;
  message: string;
  error: { code?: string; message?: string } | null;
  payload: { count: number; data: T } | null;
  page: { pageNo: number; limit: number; count: number; pageCount: number; data: T } | null;
};

export type Doctor = {
  doctorId: string;
  fullName: string;
  primarySpeciality: string;
  primaryChamberId: string | null;
  experienceYears: number;
  bmdcRegNo: string;
};

// Field names read from a live response on 2026-09-21 — the chamber's label is `name`, NOT `chamberName`.
export type Chamber = {
  chamberId: string;
  name: string;
  consultationType: string | null;
  active: boolean;
  address: string;
  districtName: string | null;
};

export type Slot = {
  availabilityId: string;
  sessionName: string;
  date: string;
  sessionStart: string;
  capacity: number;
  booked: number;
  remaining: number;
  full: boolean;
  bookable: boolean;
  // Which appointment types this session accepts, e.g.
  consultationTypes?: string[];
};

// Field names read from a live response on 2026-09-21.
export type Appointment = {
  displayTime?: string; // the CREATE response names the time this; the list uses timeSlot
  id: string;
  bookingRef: string;
  appointmentDate: string;
  timeSlot: string;
  serialNumber: number;
  appointmentType: string;
  status: string;
  sessionName: string;
  doctorId: string;
  doctorName: string;
  doctorSpeciality: string;
  chamberId: string;
  chamberName: string;
  chamberAddress: string;
  // Present once a consultation has been completed and prescribed against.
  prescriptionRxNumber: string | null;
  prescriptionStatus: string | null;
};

// Field names read from a live response on 2026-09-21.
export type Prescription = {
  id: string;
  rxNumber: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  followUpRequired: boolean;
  medicineCount: number;
  doctorId: string;
  doctorName: string;
  doctorSpeciality: string;
};

// The four appointment types the API accepts, as the spec spells them.
export const API_APPOINTMENT_TYPE = {
  inPerson: 'IN_PERSON',
  teleconsultation: 'TELECONSULTATION',
  pickup: 'PICKUP',
  followUp: 'FOLLOW_UP',
} as const;

let cachedToken: string | undefined;

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Envelope<T>> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  let json = (await response.json()) as Envelope<T>;

  if (!response.ok) {
    // A failing precondition is a BROKEN SETUP, not a test result — so it
    // throws with the API's own words rather than being asserted on.
    throw new Error(
      `[api] ${init.method ?? 'GET'} ${path} → ${response.status} ` +
        `${json?.error?.code ?? ''} ${json?.message ?? ''}`.trim(),
    );
  }
  return json;
}

// Rows from a paginated response.
function rows<T>(envelope: Envelope<T[]>): T[] {
  return envelope.page?.data ?? envelope.payload?.data ?? [];
}

// A customer access token for an explicit password — the password tests need
// one for a password that is not the .env one.
export async function loginToken(email: string, password: string): Promise<string> {
  let envelope = await call<{ accessToken: string }>('/api/v1/auth/customer/login', {
    method: 'POST',
    body: { email, password },
  });
  let token = envelope.payload?.data.accessToken;
  if (!token) throw new Error('[api] login succeeded but returned no accessToken.');
  return token;
}

// A customer access token, from the same credentials the UI logs in with.
export async function customerToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  let { email, password } = credentials();
  cachedToken = await loginToken(email, password);
  return cachedToken;
}

// PUT /customers/me/password — verified 2026-09-25: a wrong current password
// is refused with 401 AUTH_INVALID_CREDENTIALS, so this cannot change blind.
export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  await call('/api/v1/customers/me/password', { method: 'PUT', token, body: { currentPassword, newPassword } });
}

// Forget the cached token — used when a test deliberately re-authenticates.
export function resetToken(): void {
  cachedToken = undefined;
}

export async function listDoctors(search?: string): Promise<Doctor[]> {
  let token = await customerToken();
  let query = `page=0&size=50${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  return rows(await call<Doctor[]>(`/api/v1/public/doctors?${query}`, { token }));
}

export async function findDoctorByName(fullName: string): Promise<Doctor> {
  let matches = await listDoctors(fullName);
  let doctor = matches.find((d) => d.fullName === fullName);
  if (!doctor) {
    throw new Error(
      `[api] no doctor named "${fullName}" on the tenant. ` +
        `Available: ${matches.map((d) => d.fullName).join(', ') || '(none)'}`,
    );
  }
  return doctor;
}

export async function listChambers(doctorId: string): Promise<Chamber[]> {
  let token = await customerToken();
  return rows(
    await call<Chamber[]>(`/api/v1/public/doctors/${doctorId}/chambers?page=0&size=50`, { token }),
  );
}

export async function listSlots(
  doctorId: string,
  chamberId: string,
  date: string,
): Promise<Slot[]> {
  let token = await customerToken();
  // Slots come back under page.data, NOT payload.data — verified against a live
  // response. Reading only payload.data yields a silent empty array (not an
  // error), which reads as "this chamber has no availability" and made every
  // chamber on the tenant look unbookable.
  return rows(
    await call<Slot[]>(
      `/api/v1/customers/me/appointments/available-slots` +
        `?doctorId=${doctorId}&chamberId=${chamberId}&date=${date}`,
      { token },
    ),
  );
}

// The next date (from today) on which this chamber has a bookable session.
export async function findBookableSlot(
  doctorId: string,
  chamberId: string,
  searchDays = 21,
): Promise<{ date: string; slot: Slot }> {
  let found = await findBookableSlotOrNull(doctorId, chamberId, searchDays);
  if (!found) {
    throw new Error(
      `[api] no bookable session for doctor ${doctorId} at chamber ${chamberId} ` +
        `within ${searchDays} days.`,
    );
  }
  return found;
}

// A chamber of this doctor that is NOT their primary one AND actually has a bookable session.
export async function findAlternateBookableChamber(
  doctor: Doctor,
): Promise<{ chamber: Chamber; date: string; slot: Slot; appointmentType: string }> {
  let chambers = await listChambers(doctor.doctorId);
  let alternates = chambers.filter(
    (c) => c.chamberId !== doctor.primaryChamberId && c.active !== false,
  );

  for (let chamber of alternates) {
    let found = await findBookableSlotOrNull(doctor.doctorId, chamber.chamberId);
    if (found) {
      return { chamber, ...found, appointmentType: appointmentTypeFor(chamber, found.slot) };
    }
  }

  throw new Error(
    `[api] ${doctor.fullName} has no NON-PRIMARY chamber with a bookable session. ` +
      `Chambers tried: ${alternates.map((c) => c.name).join(', ') || '(none)'}`,
  );
}

// The appointment type a chamber will actually accept.
export function appointmentTypeFor(chamber: Chamber, slot?: Slot): string {
  if (chamber.consultationType) return chamber.consultationType;
  let fromSlot = slot?.consultationTypes?.[0];
  return fromSlot ?? API_APPOINTMENT_TYPE.inPerson;
}

// As findBookableSlot, but returns null instead of throwing — used when scanning several chambers, where "no availability" is an expected answer.
// As findBookableSlot, but returns null instead of throwing.
export async function findBookableSlotOrNull(
  doctorId: string,
  chamberId: string,
  searchDays = 21,
): Promise<{ date: string; slot: Slot } | null> {
  let day = new Date();
  day.setDate(day.getDate() + 1);
  for (let i = 0; i < searchDays; i += 1) {
    let date = localDate(day);
    let slots = await listSlots(doctorId, chamberId, date);
    let bookable = slots.find((s) => s.bookable && !s.full && s.remaining > 0);
    if (bookable) return { date, slot: bookable };
    day.setDate(day.getDate() + 1);
  }
  return null;
}

// Seed an appointment.
export async function createAppointment(input: {
  doctorId: string;
  chamberId: string;
  availabilityId: string;
  appointmentDate: string;
  appointmentType: string;
  reason?: string;
}): Promise<Appointment> {
  let token = await customerToken();
  let envelope = await call<Appointment>('/api/v1/customers/me/appointments', {
    method: 'POST',
    token,
    body: input,
  });

  let created = envelope.payload?.data;
  if (!created) {
    throw new Error('[api] appointment created but the response carried no appointment.');
  }
  return created;
}

export async function listAppointments(scope?: 'UPCOMING' | 'PAST'): Promise<Appointment[]> {
  let token = await customerToken();
  let query = `page=0&size=100${scope ? `&scope=${scope}` : ''}`;
  return rows(await call<Appointment[]>(`/api/v1/customers/me/appointments?${query}`, { token }));
}

// Teardown ladder RUNG 1 — the real cancel endpoint, preferred over the UI cancel now that the customer API is reachable.
export async function cancelAppointment(appointmentId: string): Promise<void> {
  let token = await customerToken();
  await call(`/api/v1/customers/me/appointments/${appointmentId}/cancel`, {
    method: 'POST',
    token,
    body: {},
  });
}

export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // local format, e.g. 01783367056
  dateOfBirth: string;
  bloodGroup: string;
  knownAllergies: string[];
  chronicConditions: string[];
  address: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string | null;
  profilePhotoUrl: string | null;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  active: boolean;
};

// The people this account can book for — the account holder (relation SELF) and any family members.
export async function listPatients(): Promise<Patient[]> {
  let token = await customerToken();
  return rows(await call<Patient[]>('/api/v1/customers/me/patients', { token }));
}

export async function getProfile(): Promise<CustomerProfile> {
  let token = await customerToken();
  let envelope = await call<CustomerProfile>('/api/v1/customers/me', { token });
  let profile = envelope.payload?.data;
  if (!profile) throw new Error('[api] /customers/me returned no profile.');
  return profile;
}

// Update the profile.
export async function updateProfile(patch: Partial<CustomerProfile>): Promise<void> {
  let token = await customerToken();
  await call('/api/v1/customers/me', { method: 'PATCH', token, body: patch });
}

// The dashboard's health snapshot, which mirrors the profile fields.
export type Dashboard = {
  firstName: string;
  displayName: string;
  healthSnapshot: {
    bloodGroup: string;
    age: number;
    dateOfBirth: string;
    allergyCount: number;
    allergies: string[];
    conditionCount: number;
    conditions: string[];
  };
  activePrescriptions: number;
  upcomingAppointments: number;
};

export async function getDashboard(): Promise<Dashboard> {
  let token = await customerToken();
  let envelope = await call<Dashboard>('/api/v1/customers/me/dashboard', { token });
  let dashboard = envelope.payload?.data;
  if (!dashboard) throw new Error('[api] /customers/me/dashboard returned no dashboard.');
  return dashboard;
}

// One prescription as the customer app reads it. Field names read from a live
// response on 2026-09-29.
export type PrescriptionDetail = Prescription & {
  shortNotes: string;
  followUpDatetime: string | null;
  doctorDesignation: string;
  doctorDegrees: string;
  doctorHospital: string;
  patientName: string;
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  patientAge: number;
  patientBloodGroup: string;
  medicines: { productName: string; genericName: string; strength: string; displayText: string; instructions: string }[];
};

export async function getPrescription(id: string): Promise<PrescriptionDetail> {
  let token = await customerToken();
  let envelope = await call<PrescriptionDetail>(`/api/v1/customers/me/prescriptions/${id}`, { token });
  let detail = envelope.payload?.data;
  if (!detail) throw new Error(`[api] /customers/me/prescriptions/${id} returned no prescription.`);
  return detail;
}

export async function listPrescriptions(): Promise<Prescription[]> {
  let token = await customerToken();
  return rows(await call<Prescription[]>('/api/v1/customers/me/prescriptions?page=0&size=50', { token }));
}
