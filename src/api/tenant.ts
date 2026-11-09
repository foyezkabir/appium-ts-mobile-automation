import * as fs from 'fs';
import * as path from 'path';
import { API_BASE_URL } from '../support/config';
import { customerToken } from './client';
import {
  doctorSeeds,
  doctorEmail,
  DOCTOR_PASSWORD,
  type DoctorSeed,
  type ChamberSeed,
} from '../data/tenant.data';

type Envelope<T> = {
  status: number;
  message: string;
  error: { code?: string; message?: string; fields?: unknown } | null;
  payload: { count: number; data: T } | null;
  page: { count: number; data: T } | null;
};

export type ProvisionedChamber = {
  key: ChamberSeed['key'];
  chamberId: string;
  name: string;
  consultationType: ChamberSeed['consultationType'];
  address: string;
  phone: string;
  fees: ChamberSeed['fees'];
  daysOfWeek: string[];
  avgConsultationTime: number;
  sessionStart: string;
  sessionEnd: string;
};

export type ProvisionedDoctor = {
  key: DoctorSeed['key'];
  doctorId: string;
  fullName: string;
  email: string;
  primarySpeciality: string;
  additionalSpecialities: string[];
  designation: string;
  formerPosition: string;
  attachedHospital: string;
  experienceYears: number;
  bmdcRegNo: string;
  token: string;
  chambers: ProvisionedChamber[];
};

const STATE_FILE = path.resolve(__dirname, '../../appium-reports/tenant.json');

async function request<T>(
  route: string,
  init: { method?: string; body?: unknown; token?: string; form?: FormData } = {},
): Promise<{ status: number; body: Envelope<T> }> {
  let headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (!init.form) headers['Content-Type'] = 'application/json';

  let response = await fetch(`${API_BASE_URL}${route}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });

  let body = (await response.json().catch(() => ({}))) as Envelope<T>;
  return { status: response.status, body };
}

function fail(route: string, status: number, body: Envelope<unknown>): never {
  throw new Error(
    `[tenant] ${route} → ${status} ${body?.error?.code ?? ''} ${body?.message ?? ''} ` +
      `${body?.error?.fields ? JSON.stringify(body.error.fields) : ''}`.trim(),
  );
}

// ---------------------------------------------------------------- doctor auth

async function loginDoctor(email: string): Promise<string | null> {
  let { status, body } = await request<{ tokens: { accessToken: string } }>(
    '/api/v1/appointment/doctor-portal/auth/login',
    { method: 'POST', body: { email, password: DOCTOR_PASSWORD } },
  );
  if (status !== 200) return null;
  return body.payload?.data.tokens.accessToken ?? null;
}

async function registerDoctor(seed: DoctorSeed): Promise<string | null> {
  let form = new FormData();
  form.append(
    'doctor',
    new Blob(
      [
        JSON.stringify({
          email: doctorEmail(seed),
          password: DOCTOR_PASSWORD,
          fullName: `${seed.firstName} ${seed.lastName}`,
          bmdcRegNo: seed.bmdcRegNo,
          primarySpeciality: seed.primarySpeciality,
          phone: `017${seed.bmdcRegNo}${seed.bmdcRegNo.slice(0, 2)}`.slice(0, 11),
          attachedHospital: seed.attachedHospital,
        }),
      ],
      { type: 'application/json' },
    ),
  );

  let { status, body } = await request<{ doctorId: string }>(
    '/api/v1/appointment/doctor-portal/auth/register',
    { method: 'POST', form },
  );

  if (status === 201) return body.payload?.data.doctorId ?? null;

  // 409 comes in two flavours and they are NOT interchangeable:
  //   DOCTOR_ACCOUNT_EMAIL_TAKEN — this seed is already provisioned; log in.
  //   BMDC_TAKEN                 — the registration number belongs to a
  //                                DIFFERENT account, so logging in as this
  //                                seed's email will fail. Say so plainly
  //                                rather than reporting a confusing auth error.
  if (status === 409) {
    if (body?.error?.code === 'BMDC_TAKEN') {
      throw new Error(
        `[tenant] BMDC ${seed.bmdcRegNo} is already registered to another account, ` +
          `so ${doctorEmail(seed)} cannot be created. Change bmdcRegNo for the ` +
          `"${seed.key}" seed in src/data/tenant.data.ts — BMDC is unique per doctor.`,
      );
    }
    return null;
  }
  fail('/auth/register', status, body);
}

async function updateDoctorProfile(seed: DoctorSeed, token: string): Promise<void> {
  let { status, body } = await request('/api/v1/appointment/doctor-portal/me', {
    method: 'PATCH',
    token,
    body: {
      firstName: seed.firstName,
      lastName: seed.lastName,
      gender: seed.gender,
      primarySpeciality: seed.primarySpeciality,
      additionalSpecialities: seed.additionalSpecialities,
      designation: seed.designation,
      formerPosition: seed.formerPosition,
      degrees: seed.degrees,
      qualifications: seed.qualifications,
      experienceYears: seed.experienceYears,
      attachedHospital: seed.attachedHospital,
    },
  });
  if (status !== 200) fail('PATCH /doctor-portal/me', status, body);
}

async function uploadDoctorPhoto(seed: DoctorSeed, token: string): Promise<void> {
  try {
    // Cached on disk after the first fetch. The portrait host is a third party
    // and a transient blip there once aborted the whole bootstrap — provisioning
    // a bookable tenant must not depend on an image CDN being up.
    let cachePath = path.resolve(
      __dirname,
      `../../appium-reports/portraits/${seed.key}.jpg`,
    );

    if (!fs.existsSync(cachePath)) {
      let image = await fetch(seed.photoUrl);
      if (!image.ok) throw new Error(`portrait fetch → ${image.status}`);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, Buffer.from(await image.arrayBuffer()));
    }

    let form = new FormData();
    form.append('photo', new Blob([fs.readFileSync(cachePath)], { type: 'image/jpeg' }), 'profile.jpg');

    let { status } = await request('/api/v1/appointment/doctor-portal/me/photo', {
      method: 'POST',
      token,
      form,
    });
    if (status !== 200) throw new Error(`upload → ${status}`);
  } catch (error) {
    console.warn(
      `[tenant] could not set a profile photo for ${seed.firstName} ${seed.lastName}. ` +
        `The account is usable without one. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function doctorProfile(token: string): Promise<{
  doctorId: string;
  fullName: string;
  designation: string | null;
  experienceYears: number | null;
  photoUrl: string | null;
}> {
  let { status, body } = await request<{
    doctorId: string;
    fullName: string;
    designation: string | null;
    experienceYears: number | null;
    photoUrl: string | null;
  }>(
    '/api/v1/appointment/doctor-portal/me',
    { token },
  );
  if (status !== 200) fail('GET /doctor-portal/me', status, body);
  return body.payload!.data;
}

// ------------------------------------------------------------------- chambers

async function listOwnChambers(
  token: string,
): Promise<Array<{ id: string; name: string; consultationType: string | null }>> {
  let { status, body } = await request<
    Array<{ id: string; name: string; consultationType: string | null }>
  >('/api/v1/appointment/doctor-portal/chambers?page=0&size=50', { token });
  if (status !== 200) fail('GET /doctor-portal/chambers', status, body);
  return body.page?.data ?? body.payload?.data ?? [];
}

async function createChamber(seed: ChamberSeed, token: string): Promise<string> {
  let { status, body } = await request<{ id: string }>(
    '/api/v1/appointment/doctor-portal/chambers',
    {
      method: 'POST',
      token,
      body: {
        name: seed.name,
        address: seed.address,
        phone: seed.phone,
        consultationType: seed.consultationType,
        avgConsultationTime: seed.avgConsultationTime,
      },
    },
  );
  if (status !== 201) fail('POST /doctor-portal/chambers', status, body);
  return body.payload!.data.id;
}

async function setChamberFees(
  chamberId: string,
  seed: ChamberSeed,
  token: string,
): Promise<void> {
  let { status, body } = await request(
    `/api/v1/appointment/doctor-portal/chambers/${chamberId}/fees`,
    { method: 'PATCH', token, body: seed.fees },
  );
  if (status !== 200) fail('PATCH /chambers/{id}/fees', status, body);
}

type AvailabilitySession = {
  id: string;
  sessionName: string;
  sessionStart: string;
  sessionEnd: string;
};

async function chamberAvailability(
  chamberId: string,
  token: string,
): Promise<AvailabilitySession[]> {
  let { status, body } = await request<AvailabilitySession[]>(
    `/api/v1/appointment/doctor-portal/chambers/${chamberId}/availability?page=0&size=100`,
    { token },
  );
  if (status !== 200) return [];
  return body.page?.data ?? body.payload?.data ?? [];
}

async function pruneMismatchedAvailability(
  chamberId: string,
  seed: ChamberSeed,
  token: string,
): Promise<AvailabilitySession[]> {
  let sessions = await chamberAvailability(chamberId, token);

  let matching = sessions.filter(
    (s) =>
      s.sessionStart?.slice(0, 5) === seed.sessionStart.slice(0, 5) &&
      s.sessionEnd?.slice(0, 5) === seed.sessionEnd.slice(0, 5),
  );
  let stale = sessions.filter((s) => !matching.includes(s));

  for (let session of stale) {
    await request(
      `/api/v1/appointment/doctor-portal/chambers/${chamberId}/availability/${session.id}`,
      { method: 'DELETE', token },
    );
  }
  return matching;
}

async function createAvailability(
  chamberId: string,
  seed: ChamberSeed,
  token: string,
): Promise<void> {
  let { status, body } = await request(
    `/api/v1/appointment/doctor-portal/chambers/${chamberId}/availability`,
    {
      method: 'POST',
      token,
      body: {
        sessionName: seed.sessionName,
        daysOfWeek: seed.daysOfWeek,
        sessionStart: seed.sessionStart,
        sessionEnd: seed.sessionEnd,
        avgConsultationTime: seed.avgConsultationTime,
        consultationTypes: [seed.consultationType],
      },
    },
  );
  if (status !== 201) fail('POST /chambers/{id}/availability', status, body);
}

async function primaryChamberId(doctorId: string): Promise<string | null> {
  let token = await customerToken();
  let { status, body } = await request<Array<{ doctorId: string; primaryChamberId: string | null }>>(
    `/api/v1/public/doctors?page=0&size=50`,
    { token },
  );
  if (status !== 200) return null;
  let rows = body.page?.data ?? body.payload?.data ?? [];
  return rows.find((r) => r.doctorId === doctorId)?.primaryChamberId ?? null;
}

// ----------------------------------------------------------------- provision

async function provisionDoctor(seed: DoctorSeed): Promise<ProvisionedDoctor> {
  let email = doctorEmail(seed);

  // LOGIN FIRST, register only if that fails.
  //
  // The obvious order — register, then log in — sends a registration attempt on
  // every single run, and the auth endpoints are rate limited per network:
  // repeated provisioning earned a 429 AUTH_RATE_LIMIT_EXCEEDED that blocked
  // the whole bootstrap. On a tenant that is already provisioned (the common
  // case) this way makes no write calls at all.
  let token = await loginDoctor(email);

  if (!token) {
    await registerDoctor(seed);
    token = await loginDoctor(email);
  }

  if (!token) {
    throw new Error(
      `[tenant] could not log in as ${email} after provisioning. ` +
        `If the account exists with a different password it must be reset by hand.`,
    );
  }

  // Only write the profile when it does not already match the seed. Re-PATCHing
  // identical values on every run is pure write traffic against a rate-limited
  // API, and it is what "reuse what exists" means in practice.
  let profile = await doctorProfile(token);
  if (
    profile.designation !== seed.designation ||
    profile.experienceYears !== seed.experienceYears
  ) {
    await updateDoctorProfile(seed, token);
    profile = await doctorProfile(token);
  }

  if (!profile.photoUrl) {
    await uploadDoctorPhoto(seed, token);
  }
  let existing = await listOwnChambers(token);
  let chambers: ProvisionedChamber[] = [];

  for (let chamberSeed of seed.chambers) {
    let match = existing.find((c) => c.name === chamberSeed.name);
    let chamberId = match?.id ?? (await createChamber(chamberSeed, token));

    await setChamberFees(chamberId, chamberSeed, token);

    // Drop anything that does not match the seed's hours, then create the week
    // only when it is genuinely absent. The API makes one session PER DAY, so
    // "already seeded" means one row per seeded day, not merely one row.
    let matching = await pruneMismatchedAvailability(chamberId, chamberSeed, token);
    if (matching.length < chamberSeed.daysOfWeek.length) {
      for (let session of matching) {
        await request(
          `/api/v1/appointment/doctor-portal/chambers/${chamberId}/availability/${session.id}`,
          { method: 'DELETE', token },
        );
      }
      await createAvailability(chamberId, chamberSeed, token);
    }

    chambers.push({
      key: chamberSeed.key,
      chamberId,
      name: chamberSeed.name,
      consultationType: chamberSeed.consultationType,
      address: chamberSeed.address,
      phone: chamberSeed.phone,
      fees: chamberSeed.fees,
      daysOfWeek: chamberSeed.daysOfWeek,
      avgConsultationTime: chamberSeed.avgConsultationTime,
      sessionStart: chamberSeed.sessionStart,
      sessionEnd: chamberSeed.sessionEnd,
    });
  }

  // WHICH CHAMBER IS "PRIMARY" IS THE BACKEND'S DECISION, NOT THE SEED'S.
  //
  // The seed's `key: 'primary'` is only a label for the suite's own reference.
  // The app opens the doctor profile on whatever the API reports as
  // primaryChamberId — verified 2026-09-23, where that was the teleconsultation
  // chamber, not the one the seed called primary. Asserting the label instead
  // of the truth failed a test that the app had got right.
  //
  // So re-key the provisioned chambers from the API: the real primary becomes
  // 'primary', and the others keep a stable non-primary identity.
  //
  // The non-primary keys come from each chamber's own consultationType, NEVER
  // from its position in the list. Keying by position labelled an IN_PERSON
  // chamber 'teleconsultation' simply because it sorted first, so
  // alternateChamber() returned an in-person chamber and every
  // teleconsultation assertion failed against a correct app. Verified
  // 2026-09-24: the backend's primary here IS the online chamber, which is
  // exactly the case position-keying gets wrong.
  let apiPrimaryId = await primaryChamberId(profile.doctorId);
  if (apiPrimaryId) {
    let secondaryTaken = false;
    chambers = chambers.map((c): ProvisionedChamber => {
      if (c.chamberId === apiPrimaryId) return { ...c, key: 'primary' };
      if (c.consultationType === 'TELECONSULTATION') {
        return { ...c, key: 'teleconsultation' };
      }
      if (c.consultationType === 'BOTH') return { ...c, key: 'hybrid' };
      // 'secondary' names exactly ONE chamber — the first non-primary in-person
      // one. A further in-person chamber keeps the key the seed gave it rather
      // than duplicating a reserved key, because provisionedChamber() returns
      // the FIRST match and a shared key silently resolves to whichever sorted
      // first. That positional ambiguity is the trap this re-key exists to
      // remove, so tests needing a specific chamber resolve by
      // consultationType (see fixtures) rather than by key.
      if (!secondaryTaken) {
        secondaryTaken = true;
        return { ...c, key: 'secondary' };
      }
      return c;
    });
  }

  return {
    key: seed.key,
    doctorId: profile.doctorId,
    fullName: profile.fullName,
    email,
    primarySpeciality: seed.primarySpeciality,
    additionalSpecialities: seed.additionalSpecialities,
    designation: seed.designation,
    formerPosition: seed.formerPosition,
    attachedHospital: seed.attachedHospital,
    experienceYears: seed.experienceYears,
    bmdcRegNo: seed.bmdcRegNo,
    token,
    chambers,
  };
}

// Provision every seeded doctor and cache the result for the specs.
export async function provisionTenant(): Promise<ProvisionedDoctor[]> {
  let doctors: ProvisionedDoctor[] = [];
  for (let seed of doctorSeeds) {
    doctors.push(await provisionDoctor(seed));
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(doctors, null, 2));
  return doctors;
}

// The provisioned tenant, as written by global setup.
export function provisionedDoctors(): ProvisionedDoctor[] {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `[tenant] ${STATE_FILE} is missing — global setup did not run. ` +
        `The specs resolve their fixtures from it rather than from hardcoded names.`,
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as ProvisionedDoctor[];
}

// Resolve a doctor by its stable key, never by display name.
export function provisionedDoctor(key: DoctorSeed['key']): ProvisionedDoctor {
  let doctor = provisionedDoctors().find((d) => d.key === key);
  if (!doctor) throw new Error(`[tenant] no provisioned doctor with key "${key}".`);
  return doctor;
}

// Resolve one of a doctor's chambers by its stable key.
export function provisionedChamber(
  doctorKey: DoctorSeed['key'],
  chamberKey: ChamberSeed['key'],
): ProvisionedChamber {
  let doctor = provisionedDoctor(doctorKey);
  let chamber = doctor.chambers.find((c) => c.key === chamberKey);
  if (!chamber) {
    throw new Error(`[tenant] ${doctor.fullName} has no "${chamberKey}" chamber.`);
  }
  return chamber;
}
