import { useAppointments } from '../src/support/appointments.fixture';
import {
  seedAppointment, seedAppointmentsSoonestAndLater, seedCancelledAppointment, seedCompletedAppointmentAt,
  completeSeededAppointment, appointmentTypes, APPOINTMENT_DETAIL_TYPE_LABEL,
} from '../src/support/appointments.kit';

describe('My Appointments', () => {
  let fx = useAppointments();

  test('TC-01: Verify that an upcoming row shows the doctor, speciality, status, date, time and serial, and opens the matching detail and back', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectUpcomingRowShows(fx.seeded, fx.doctor.primarySpeciality);

    await fx.appointments.openAppointmentByReference(fx.seeded.bookingRef);
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailShowsWhen(fx.seeded);

    await fx.appointments.backToList();
    await fx.appointments.expectUpcomingRowShows(fx.seeded, fx.doctor.primarySpeciality);
  });

  test('TC-02: Verify that the soonest appointment lists before a later one, and each row opens its own detail', async () => {
    fx.pair = await seedAppointmentsSoonestAndLater(fx.doctor);
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectUpcomingRowShows(fx.pair[0], fx.doctor.primarySpeciality);
    await fx.appointments.expectUpcomingSoonestFirst(fx.pair);

    await fx.appointments.openAppointmentByReference(fx.pair[1].bookingRef);
    await fx.appointments.expectDetailShowsWhen(fx.pair[1]);
    await fx.appointments.backToList();
    await fx.appointments.openAppointmentByReference(fx.pair[0].bookingRef);
    await fx.appointments.expectDetailShowsWhen(fx.pair[0]);
  });

  test('TC-03: Verify that completed and cancelled appointments show their final status, a completed one offers quick actions, and neither can be cancelled, joined or tracked', async () => {
    await fx.appointments.openUpcomingList();
    await fx.appointments.openFirstPastAppointmentWithStatus('Completed');
    await fx.appointments.expectCompletedDetailIsFinal();

    await fx.appointments.backToList();
    await fx.appointments.openFirstPastAppointmentWithStatus('Cancelled');
    await fx.appointments.expectCancelledDetailOffersNoActions();
  });

  test('TC-04: Verify that dismissing the cancellation sheet keeps the appointment scheduled, including after the app reloads it', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    await fx.appointments.openFreshlyBooked({ reference: fx.seeded.bookingRef });
    await fx.appointments.openCancelSheetAndKeepAppointment();

    await fx.appointments.openFreshlyBooked({ reference: fx.seeded.bookingRef }); // restart = the server's view
    await fx.appointments.expectDetailStatusIsScheduled();
  });

  test('TC-05: Verify that an empty upcoming list says so and its Book Appointment button opens the doctor picker', async () => {
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectUpcomingIsEmpty();
    await fx.appointments.startBookingFromList();
    await fx.booking.expectSelectDoctorIsOpen();
  });

  test('TC-06: Verify that a cancelled appointment moves to the Past tab straight away and its row shows the doctor, speciality, Cancelled, date, time and serial', async () => {
    fx.seeded = await seedCancelledAppointment(fx.doctor);
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectPastRowShows(fx.seeded, fx.doctor.primarySpeciality, 'CANCELLED');
  });

  test('TC-07: Verify that "Book follow-up" on a completed appointment opens its doctor and chamber with Follow-up pre-selected, books it, and the booking carries the Follow-up chip', async () => {
    fx.completed = await seedCompletedAppointmentAt(fx.doctor, fx.followUpChamber); // booked and completed via the API
    await fx.appointments.openUpcomingList();
    await fx.appointments.openPastAppointmentByReference(fx.completed);
    await fx.appointments.expectCompletedDetailIsFinal();

    await fx.appointments.startFollowUpBooking();
    await fx.booking.expectDoctorProfileIsOpen(fx.doctor.fullName);
    await fx.booking.expectChamberDetailsAreShown(fx.followUpChamber);

    await fx.booking.openDateSheet();
    await fx.booking.chooseFirstBookableDay();
    await fx.booking.expectFollowUpIsPreselected();
    await fx.booking.continueToConfirmation();
    await fx.booking.expectConfirmationShowsChamber(fx.followUpChamber.name);
    await fx.booking.confirmBooking();
    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);

    await fx.appointments.openUpcomingList();
    await fx.appointments.openAppointmentByChamber(fx.followUpChamber.name);
    await fx.appointments.expectDetailShowsType(APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.followUp]);
  });

  test('TC-08: Verify that an upcoming appointment the doctor completes leaves Upcoming and appears in the Past tab as Completed', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectUpcomingRowShows(fx.seeded, fx.doctor.primarySpeciality);

    await completeSeededAppointment(fx.doctor, fx.seeded); // doctor side, via the API — permanent, reused by Prescriptions
    await fx.appointments.openUpcomingList();
    await fx.appointments.expectUpcomingIsEmpty();
    await fx.appointments.expectPastRowShows(fx.seeded, fx.doctor.primarySpeciality, 'COMPLETED');
    await fx.appointments.expectCompletedDetailIsFinal();
  });
});
