import { API_BASE_URL } from '../support/config';

// Doctor-portal API — used ONLY to put the customer account into a state the customer app can then be tested against.

type Envelope<T> = {
  status: number;
  message: string;
  error: { code?: string; message?: string } | null;
  payload: { count: number; data: T } | null;
  page: { data: T } | null;
};

export type IssuedPrescription = {
  id: string;
  rxNumber: string;
  status: string;
  issuedAt: string;
  followUpRequired: boolean;
  medicineCount: number;
  doctorId: string;
  doctorName: string;
  // Set when followUpRequired booked the follow-up; null with a reason when it could not.
  followUpAppointmentId?: string | null;
  followUpFailureReason?: string | null;
};

// The structured schedule. These fields sit ON the medicine line: nested under
// `schedule` (as the OpenAPI Medicine schema suggests) they are silently
// discarded. They are also kept only when the line carries a catalogue
// productId. Both measured 2026-09-29; valid dayPattern values are the ones
// the API's own 400 names: EVERY_DAY, EVERY_N_DAYS, WEEKDAYS, DAYS_ON_OFF.
export type MedicineSchedule = {
  slotMorning?: number;
  slotNoon?: number;
  slotNight?: number;
  dayPattern?: 'EVERY_DAY' | 'EVERY_N_DAYS' | 'WEEKDAYS' | 'DAYS_ON_OFF';
  repeatEveryDays?: number;
  weekdays?: number; // bitmask, Monday = 1 (42 renders "Tue, Thu, Sat")
  daysOn?: number;
  daysOff?: number;
  frequencyCode?: 'EVERY_N_HOURS';
  intervalHours?: number;
  durationValue?: number;
  durationUnit?: 'DAY' | 'WEEK' | 'MONTH';
  continuous?: boolean;
  foodRelation?: 'BEFORE_MEAL' | 'AFTER_MEAL';
};

// A medicine line.
export type MedicineLine = MedicineSchedule & {
  lineNo: number;
  productId?: string;
  productName: string;
  genericName?: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export type PrescriptionInput = {
  shortNotes: string;
  medicines: MedicineLine[];
  followUpRequired?: boolean;
  followUpDatetime?: string;
};

export type CatalogueMedicine = {
  id: string;
  productName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
};

// NOTE: there is deliberately no module-level doctorToken() here.
async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; token: string },
): Promise<Envelope<T>> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${init.token}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  let json = (await response.json()) as Envelope<T>;
  if (!response.ok) {
    throw new Error(
      `[doctor-api] ${init.method ?? 'GET'} ${path} → ${response.status} ` +
        `${json?.error?.code ?? ''} ${json?.message ?? ''}`.trim(),
    );
  }
  return json;
}

// Step 1 of the state machine.
export async function checkInAppointment(
  appointmentId: string,
  token: string,
): Promise<void> {
  await call(`/api/v1/appointments/${appointmentId}/checkin`, { method: 'PATCH', token });
}

// Step 2.
export async function completeAppointment(
  appointmentId: string,
  token: string,
): Promise<void> {
  await call(`/api/v1/appointments/${appointmentId}/complete`, { method: 'PATCH', token });
}

function prescriptionBody(input: PrescriptionInput) {
  return {
    consultationNotes: {
      shortNotes: input.shortNotes,
      followUpRequired: input.followUpRequired ?? false,
      followUpDatetime: input.followUpDatetime,
    },
    medicines: input.medicines,
    advisedTests: [],
  };
}

// A catalogue medicine by brand, strength and dosage form. The form matters:
// "Napa 500 mg" is first a SUPPOSITORY in the catalogue, not the tablet.
export async function catalogueMedicine(
  brand: string,
  strength: string,
  dosageFormPrefix: string,
  token: string,
): Promise<CatalogueMedicine> {
  let envelope = await call<CatalogueMedicine[]>(
    `/api/v1/master-data/medicines/search?q=${encodeURIComponent(brand)}`,
    { token },
  );
  let hit = (envelope.payload?.data ?? []).find(
    (m) => m.productName === brand && m.strength === strength && m.dosageForm.startsWith(dosageFormPrefix),
  );
  if (!hit) throw new Error(`[doctor-api] the catalogue has no ${brand} ${strength} ${dosageFormPrefix}.`);
  return hit;
}

// "Save" — the doctor's DRAFT upsert. Mints no Rx number, sends nothing, and
// must never reach the patient.
export async function saveDraftPrescription(
  appointmentId: string,
  input: PrescriptionInput,
  token: string,
): Promise<void> {
  await call(`/api/v1/appointments/${appointmentId}/prescription`, {
    method: 'PUT',
    token,
    body: prescriptionBody(input),
  });
}

// The appointment's prescription as the doctor sees it — the issued one, or the open DRAFT.
export async function doctorViewOfPrescription(
  appointmentId: string,
  token: string,
): Promise<{ status: string; rxNumber: string | null }> {
  let envelope = await call<{ status: string; rxNumber: string | null }>(
    `/api/v1/appointments/${appointmentId}/prescription`,
    { token },
  );
  let found = envelope.payload?.data;
  if (!found) throw new Error(`[doctor-api] appointment ${appointmentId} has no prescription.`);
  return found;
}

// Step 3 — "Complete & Generate": finalise the prescription to ACTIVE so the patient can see it.
export async function issuePrescription(
  appointmentId: string,
  input: PrescriptionInput,
  token: string,
): Promise<IssuedPrescription> {
  let envelope = await call<IssuedPrescription>(
    `/api/v1/appointments/${appointmentId}/prescription/complete`,
    { method: 'POST', token, body: prescriptionBody(input) },
  );

  let issued = envelope.payload?.data;
  if (!issued) {
    throw new Error('[doctor-api] prescription issued but the response carried no prescription.');
  }
  return issued;
}

// The whole chain: check in → complete → issue an ACTIVE prescription.
export async function completeConsultationWithPrescription(
  appointmentId: string,
  input: PrescriptionInput,
  token: string,
): Promise<IssuedPrescription> {
  await checkInAppointment(appointmentId, token);
  await completeAppointment(appointmentId, token);
  return issuePrescription(appointmentId, input, token);
}
