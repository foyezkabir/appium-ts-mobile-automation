import * as api from './client';
import * as doctorApi from './doctor';
import { provisionedDoctor, type ProvisionedDoctor, type ProvisionedChamber } from './tenant';
import { ErrorHelper } from '../support/ErrorHelper';
import { localDate } from '../support/dates';
import type { PrescribedMedicine } from '../data/prescriptions.data';

export type SeededAppointment = {
  id: string;
  bookingRef: string;
  doctorId: string;
  doctorName: string;
  chamberId: string;
  chamberName: string;
  appointmentDate: string;
  timeSlot: string;
  appointmentType: string;
  serialNumber: number;
};

async function bookAt(
  doctor: ProvisionedDoctor,
  chamber: ProvisionedChamber,
): Promise<SeededAppointment> {
  let found = await api.findBookableSlotOrNull(doctor.doctorId, chamber.chamberId);
  if (!found) {
    throw new Error(
      `[seed] no bookable session for ${doctor.fullName} at "${chamber.name}" ` +
        `in the search window. The bootstrap should have created availability.`,
    );
  }

  // A chamber is TYPED and the API enforces it: booking IN_PERSON at a
  // teleconsultation chamber returns 400 VALIDATION_ERROR. Take the type from
  // the chamber, never assume in-person.
  let appointmentType = chamber.consultationType ?? found.slot.consultationTypes?.[0] ?? 'IN_PERSON';

  let created = await api.createAppointment({
    doctorId: doctor.doctorId,
    chamberId: chamber.chamberId,
    availabilityId: found.slot.availabilityId,
    appointmentDate: found.date,
    appointmentType,
  });

  return {
    id: created.id,
    bookingRef: created.bookingRef,
    doctorId: doctor.doctorId,
    doctorName: doctor.fullName,
    chamberId: chamber.chamberId,
    chamberName: chamber.name,
    appointmentDate: found.date,
    timeSlot: created.displayTime ?? created.timeSlot,
    appointmentType: created.appointmentType,
    serialNumber: created.serialNumber,
  };
}

export async function seedAppointment(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<SeededAppointment> {
  let chamber = doctor.chambers.find((c) => c.key === 'primary') ?? doctor.chambers[0];
  if (!chamber) throw new Error(`[seed] ${doctor.fullName} has no chamber to book at.`);
  return bookAt(doctor, chamber);
}

export async function seedAppointmentAtAlternateChamber(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<SeededAppointment> {
  let chamber = doctor.chambers.find((c) => c.key !== 'primary');
  if (!chamber) {
    throw new Error(
      `[seed] ${doctor.fullName} has only one chamber, so chamber switching ` +
        `cannot be seeded. The bootstrap should provision several.`,
    );
  }
  return bookAt(doctor, chamber);
}

// Seed an appointment and drive it into the PAST.
// NOT CANCELLABLE afterwards — a COMPLETED appointment is permanent.
// A completed appointment at a CHOSEN chamber. Follow-up needs one at an
// in-person, non-default chamber: the default chamber would be preselected
// anyway, and a teleconsultation-only chamber does not offer Follow-up at all.
// PERMANENT — a completed appointment can never be cancelled.
export async function seedCompletedAppointmentAt(
  doctor: ProvisionedDoctor,
  chamber: ProvisionedChamber,
): Promise<SeededAppointment> {
  let appointment = await bookAt(doctor, chamber);
  await doctorApi.checkInAppointment(appointment.id, doctor.token);
  await doctorApi.completeAppointment(appointment.id, doctor.token);
  return appointment;
}

// The DOCTOR completes an appointment the customer already holds — check-in
// first, the state machine refuses a complete from SCHEDULED.
// PERMANENT — and the one appointments TC-08 leaves each run is the appointment
// the Prescriptions module issues its prescription against.
export async function completeSeededAppointment(
  doctor: ProvisionedDoctor,
  appointment: SeededAppointment,
) {
  await doctorApi.checkInAppointment(appointment.id, doctor.token);
  await doctorApi.completeAppointment(appointment.id, doctor.token);
}

export async function seedCompletedAppointment(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<SeededAppointment> {
  let appointment = await seedAppointment(doctor);
  await doctorApi.checkInAppointment(appointment.id, doctor.token);
  await doctorApi.completeAppointment(appointment.id, doctor.token);
  return appointment;
}

// ------------------------------------------------------------ prescriptions

// The doctor's medicine lines, each resolved to a catalogue productId — the
// structured schedule is stored only for a catalogue line.
async function catalogueLines(
  medicines: PrescribedMedicine[],
  doctor: ProvisionedDoctor,
): Promise<doctorApi.MedicineLine[]> {
  let lines: doctorApi.MedicineLine[] = [];
  for (let [index, medicine] of medicines.entries()) {
    let { brand, strength, dosageForm, shows, ...written } = medicine;
    let product = await doctorApi.catalogueMedicine(brand, strength, dosageForm, doctor.token);
    lines.push({
      ...written,
      lineNo: index + 1,
      productId: product.id,
      productName: product.productName,
      genericName: product.genericName,
      strength: product.strength,
    });
  }
  return lines;
}

// A doctor mid-consultation: a DRAFT saved and never finalised. Booked at the
// ALTERNATE chamber (one booking per chamber per day) and left SCHEDULED —
// a CHECKED_IN appointment can be cancelled by neither the customer nor the
// doctor (409, measured 2026-09-29), so it would leak and hold the chamber-day.
export async function seedDraftPrescription(
  doctor: ProvisionedDoctor,
  input: { shortNotes: string; medicines: PrescribedMedicine[] },
): Promise<SeededAppointment> {
  let appointment = await seedAppointmentAtAlternateChamber(doctor);
  await doctorApi.saveDraftPrescription(
    appointment.id,
    { shortNotes: input.shortNotes, medicines: await catalogueLines(input.medicines, doctor) },
    doctor.token,
  );
  let saved = await doctorApi.doctorViewOfPrescription(appointment.id, doctor.token);
  if (saved.status !== 'DRAFT' || saved.rxNumber) {
    throw new Error(`[seed] the draft saved as ${saved.status} ${saved.rxNumber ?? ''} — not a DRAFT, so the draft tests would prove nothing.`);
  }
  return appointment;
}

export type SeededIssuedPrescription = {
  appointment: SeededAppointment;
  prescription: api.PrescriptionDetail;
  followUpAppointmentId: string | null;
};

// The normal path: check in → complete → save the draft → Complete & Generate,
// requesting a follow-up. PERMANENT — the completed appointment and the ACTIVE
// prescription cannot be removed. The follow-up it books is cancellable.
export async function seedIssuedPrescription(
  doctor: ProvisionedDoctor,
  input: { shortNotes: string; medicines: PrescribedMedicine[]; followUpInDays: number },
): Promise<SeededIssuedPrescription> {
  let appointment = await seedAppointment(doctor);
  await doctorApi.checkInAppointment(appointment.id, doctor.token);
  await doctorApi.completeAppointment(appointment.id, doctor.token);

  let written: doctorApi.PrescriptionInput = {
    shortNotes: input.shortNotes,
    medicines: await catalogueLines(input.medicines, doctor),
    followUpRequired: true,
    followUpDatetime: new Date(Date.now() + input.followUpInDays * 864e5).toISOString(),
  };
  await doctorApi.saveDraftPrescription(appointment.id, written, doctor.token);
  let issued = await doctorApi.issuePrescription(appointment.id, written, doctor.token);
  if (!issued.followUpAppointmentId) {
    console.warn(`[seed] the follow-up was not booked: ${issued.followUpFailureReason ?? 'no reason given'}.`);
  }

  return {
    appointment,
    prescription: await api.getPrescription(issued.id),
    followUpAppointmentId: issued.followUpAppointmentId ?? null,
  };
}

// What the server says the customer holds: the count, the newest and the oldest Rx number.
export async function issuedPrescriptionsSummary(): Promise<{ count: number; newestRxNumber: string; oldestRxNumber: string }> {
  let issued = [...(await api.listPrescriptions())].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  if (issued.length === 0) throw new Error('[seed] the customer holds no issued prescription after seeding one.');
  return { count: issued.length, newestRxNumber: issued[0].rxNumber, oldestRxNumber: issued[issued.length - 1].rxNumber };
}

// The follow-up Complete & Generate booked. NEVER THROWS — teardown.
export async function cancelFollowUp(appointmentId: string | null): Promise<void> {
  if (!appointmentId) return;
  await ErrorHelper.warnOnFailure(() => api.cancelAppointment(appointmentId), `cancel follow-up ${appointmentId}`);
}

// NEVER THROWS: teardown runs after the assertions, so an error here would
// redden a correct result and hide the real outcome.
export async function cancelSeeded(appointment: SeededAppointment | undefined): Promise<void> {
  if (!appointment) return;
  try {
    await api.cancelAppointment(appointment.id);
  } catch (error) {
    console.warn(
      `[teardown] could not cancel ${appointment.bookingRef} (${appointment.doctorName}). ` +
        `It may still be live and will need cancelling by hand. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function cancelUpcomingFor(
  doctorId: string,
  exceptBookingRef?: string,
): Promise<void> {
  let mine: Awaited<ReturnType<typeof api.listAppointments>> = [];
  await ErrorHelper.warnOnFailure(async () => {
    let upcoming = await api.listAppointments('UPCOMING');
    mine = upcoming.filter((a) => a.doctorId === doctorId && a.bookingRef !== exceptBookingRef);
  }, `could not list upcoming appointments for doctor ${doctorId}`);

  // Per item, so one uncancellable appointment cannot strand the rest.
  await ErrorHelper.eachWarnOnFailure(
    mine,
    (appointment) => api.cancelAppointment(appointment.id),
    (a) => `could not cancel ${a.bookingRef} (${a.status})`,
  );
}

export async function remainingSlots(
  doctor: ProvisionedDoctor,
  chamber: ProvisionedChamber,
): Promise<{ date: string; availabilityId: string; remaining: number; capacity: number }> {
  let found = await api.findBookableSlotOrNull(doctor.doctorId, chamber.chamberId);
  if (!found) {
    throw new Error(`[seed] no bookable session at "${chamber.name}" to read a slot count from.`);
  }
  return {
    date: found.date,
    availabilityId: found.slot.availabilityId,
    remaining: found.slot.remaining,
    capacity: found.slot.capacity,
  };
}

export async function remainingSlotsFor(
  doctor: ProvisionedDoctor,
  chamber: ProvisionedChamber,
  date: string,
  availabilityId: string,
): Promise<number> {
  let slots = await api.listSlots(doctor.doctorId, chamber.chamberId, date);
  let slot = slots.find((s) => s.availabilityId === availabilityId);
  if (!slot) throw new Error(`[seed] session ${availabilityId} is gone from ${date}.`);
  return slot.remaining;
}

export async function clearAllUpcoming(): Promise<BlockedSession[]> {
  let blocked: BlockedSession[] = [];
  let upcoming: Awaited<ReturnType<typeof api.listAppointments>> = [];

  try {
    upcoming = await api.listAppointments('UPCOMING');
  } catch (error) {
    console.warn(
      `[teardown] could not list upcoming appointments. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
    return blocked;
  }

  let failed = await ErrorHelper.eachWarnOnFailure(
    upcoming,
    (appointment) => api.cancelAppointment(appointment.id),
    (a) =>
      `${a.bookingRef} (${a.status}) cannot be cancelled, so ${a.chamberName} ` +
      `on ${a.appointmentDate} stays booked`,
  );

  for (let appointment of failed) {
    blocked.push({
      bookingRef: appointment.bookingRef,
      chamberId: appointment.chamberId,
      date: appointment.appointmentDate,
      status: appointment.status,
    });
  }
  return blocked;
}

export type BlockedSession = {
  bookingRef: string;
  chamberId: string;
  date: string;
  status: string;
};

// PATIENT_JOINED can never be cancelled by the customer and never clears, so
// the doctor completes it to free the chamber-day. NEVER THROWS.
export async function releaseJoinedAppointments(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<void> {
  try {
    let joined = (await api.listAppointments('UPCOMING')).filter(
      (a) => a.status === 'PATIENT_JOINED' && a.doctorId === doctor.doctorId,
    );
    for (let appointment of joined) {
      await doctorApi.completeAppointment(appointment.id, doctor.token);
    }
  } catch (error) {
    console.warn(
      `[teardown] could not release joined appointments for ${doctor.fullName}. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Seed a teleconsultation on a FUTURE day, so its join link is not yet active.
// findBookableSlotOrNull starts from tomorrow, so this is future by construction.
export async function seedTeleconsultationFuture(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<SeededAppointment> {
  let chamber = doctor.chambers.find(
    (c) => c.consultationType === 'TELECONSULTATION' || c.consultationType === 'BOTH',
  );
  if (!chamber) {
    throw new Error(`[seed] ${doctor.fullName} has no teleconsultation-capable chamber.`);
  }
  return bookAt(doctor, chamber);
}

// Assertion-free; the caller decides what is correct. Needed because the Past
// list is virtualised, so purity and order cannot be read off the screen.
export async function pastAppointmentSummary(): Promise<
  Array<{ bookingRef: string; status: string; at: string }>
> {
  let rows = await api.listAppointments('PAST');
  return rows.map((r) => ({
    bookingRef: r.bookingRef,
    status: r.status,
    at: `${r.appointmentDate} ${r.timeSlot}`,
  }));
}

export async function expectNoUpcomingBookingWasCreated(): Promise<void> {
  let upcoming = await api.listAppointments('UPCOMING');
  if (upcoming.length > 0) {
    throw new Error(
      `Expected no upcoming booking after backing out, but found ${upcoming.length}: ` +
        upcoming.map((a) => a.bookingRef).join(', '),
    );
  }
}

// Measures the whole book-then-cancel cycle against ONE session, so a spec needs
// no intermediate variables. Returns the three counts for the page object to
// judge; no assertions here (zero tolerance #7).
export async function slotCountAcrossBookAndCancel(
  doctor: ProvisionedDoctor,
  chamber: ProvisionedChamber,
): Promise<{ before: number; afterBooking: number; afterCancel: number }> {
  let session = await remainingSlots(doctor, chamber);

  let created = await bookAt(doctor, chamber);
  let afterBooking = await remainingSlotsFor(
    doctor,
    chamber,
    session.date,
    session.availabilityId,
  );

  await cancelSeeded(created);
  let afterCancel = await remainingSlotsFor(
    doctor,
    chamber,
    session.date,
    session.availabilityId,
  );

  return { before: session.remaining, afterBooking, afterCancel };
}

// Two bookings at ONE in-person chamber: its first two bookable days, soonest
// first. Different days keep them inside the one-booking-per-chamber-per-day rule.
// Today is not an option: the API refuses it ("Appointments can be booked from
// tomorrow onwards"), so the soonest booking a customer can hold is tomorrow's.
export async function seedAppointmentsSoonestAndLater(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<[SeededAppointment, SeededAppointment]> {
  let chamber = doctor.chambers.find(
    (c) => (c.consultationType === 'IN_PERSON' || c.consultationType === 'BOTH') && c.daysOfWeek.length >= 5,
  );
  if (!chamber) throw new Error(`[seed] ${doctor.fullName} has no in-person chamber open most days.`);

  let dates: Array<{ date: string; availabilityId: string }> = [];
  let day = new Date();
  for (let i = 0; i < 21 && dates.length < 2; i += 1) {
    let date = localDate(day);
    let slot = (await api.listSlots(doctor.doctorId, chamber.chamberId, date)).find(
      (s) => s.bookable && !s.full && s.remaining > 0,
    );
    if (slot) dates.push({ date, availabilityId: slot.availabilityId });
    day.setDate(day.getDate() + 1);
  }
  if (dates.length < 2) {
    throw new Error(`[seed] "${chamber.name}" has fewer than two bookable days in the next 21.`);
  }

  let made: SeededAppointment[] = [];
  for (let d of dates) {
    let created = await api.createAppointment({
      doctorId: doctor.doctorId,
      chamberId: chamber.chamberId,
      availabilityId: d.availabilityId,
      appointmentDate: d.date,
      appointmentType: chamber.consultationType === 'BOTH' ? 'IN_PERSON' : chamber.consultationType,
    });
    made.push({
      id: created.id,
      bookingRef: created.bookingRef,
      doctorId: doctor.doctorId,
      doctorName: doctor.fullName,
      chamberId: chamber.chamberId,
      chamberName: chamber.name,
      appointmentDate: d.date,
      timeSlot: created.displayTime ?? created.timeSlot,
      appointmentType: created.appointmentType,
      serialNumber: created.serialNumber,
    });
  }
  return [made[0], made[1]];
}

// Makes sure the Past tab has a COMPLETED and a CANCELLED appointment to show.
// Reuses what exists: a completed appointment is permanent, so one is created
// only on an empty tenant.
export async function ensureFinishedAppointmentsExist(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
) {
  let past = await api.listAppointments('PAST');
  if (!past.some((a) => a.status === 'COMPLETED')) await seedCompletedAppointment(doctor);
  if (!past.some((a) => a.status === 'CANCELLED')) await cancelSeeded(await seedAppointment(doctor));
}


// Book an appointment and cancel it at once. A cancelled appointment moves to
// Past straight away — and leaves no permanent record, unlike a completed one.
export async function seedCancelledAppointment(
  doctor: ProvisionedDoctor = provisionedDoctor('cardiologist'),
): Promise<SeededAppointment> {
  let appointment = await seedAppointment(doctor);
  await cancelSeeded(appointment);
  return appointment;
}
