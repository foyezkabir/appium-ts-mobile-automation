// One import surface for a booking spec: everything a test calls that is not a
// page object. Keeps a spec's header to one line per concern instead of four
// multi-line blocks.
export {
  seedAppointment,
  seedTeleconsultationFuture,
  cancelSeeded,
  expectNoUpcomingBookingWasCreated,
  pastAppointmentSummary,
  slotCountAcrossBookAndCancel,
} from '../api/seed';

export { appointmentTypes, type AppointmentType } from '../data/booking.data';
export { weekdayLabels, sessionHours } from '../data/fixtures';
export { CHAMBER_ENABLES_TYPES } from '../locators/booking.locators';
export { APPOINTMENT_DETAIL_TYPE_LABEL } from '../locators/appointments.locators';
export type { ProvisionedChamber } from '../api/tenant';
