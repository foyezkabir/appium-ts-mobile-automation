import { useBooking } from '../src/support/booking.fixture';
import {
  seedAppointment, seedTeleconsultationFuture,
  expectNoUpcomingBookingWasCreated, pastAppointmentSummary, slotCountAcrossBookAndCancel,
  appointmentTypes, APPOINTMENT_DETAIL_TYPE_LABEL, CHAMBER_ENABLES_TYPES,
} from '../src/support/booking.kit';

describe('Book an appointment', () => {
  let fx = useBooking();

  test('TC-01: Verify that choosing a doctor opens that doctor profile on the primary chamber with every chamber, credential, charge and sitting day shown', async () => {
    await fx.booking.openFromDashboard();
    await fx.booking.expectSelectDoctorIsOpen();
    await fx.booking.searchDoctor(fx.doctor.fullName);
    await fx.booking.openDoctorProfile(fx.doctor.fullName, fx.doctor.primarySpeciality);

    await fx.booking.expectDoctorProfileIsOpen(fx.doctor.fullName);
    await fx.booking.expectChamberSelectorIsShown();
    await fx.booking.expectChamberIsSelected(fx.defaultChamber.name);
    await fx.booking.expectEveryChamberIsOffered(fx.doctor.chambers.map((c) => c.name));

    await fx.booking.expectCredentialsAreShown();
    await fx.booking.expectChamberDetailsAreShown(fx.defaultChamber);
    await fx.booking.expectVisitChargesAreShown();
    await fx.booking.expectFeeLabelsAndHintsAreShown();
    await fx.booking.expectVisitChargesMatch(fx.defaultChamber.fees);
    await fx.booking.expectChamberScheduleIsShown(fx.defaultChamber);
  });

  test('TC-02: Verify that switching to a chamber of a different type updates its details, fees, sitting days, calendar and the appointment types it enables', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);

    await fx.booking.expectChamberRendersEverywhere(fx.inPerson, CHAMBER_ENABLES_TYPES.IN_PERSON);
    await fx.booking.expectChamberRendersEverywhere(fx.videoChamber, CHAMBER_ENABLES_TYPES.TELECONSULTATION);
    await fx.booking.expectChamberRendersEverywhere(fx.hybrid, CHAMBER_ENABLES_TYPES.BOTH);
  });

  test('TC-03: Verify that the calendar opens on the current month with no past day bookable, moves forward to the doctor future schedule, and marks the days the doctor does not sit', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.selectChamber(fx.sparseChamber); // a partial week, so "Off" days exist
    await fx.booking.openDateSheet();

    await fx.booking.expectDateSheetIsOpen();
    await fx.booking.expectCurrentMonthIsShown();
    await fx.booking.expectPastDaysAreNotBookable();
    await fx.booking.expectPreviousMonthIsDisabled();
    await fx.booking.expectAtLeastOneBookableDay();
    await fx.booking.expectSomeDaysAreOff();

    await fx.booking.expectNextMonthIsEnabled();
    await fx.booking.goToNextMonth();
    await fx.booking.expectMonthIsNotCurrent();
    await fx.booking.expectAtLeastOneBookableDay(); // the schedule continues forward
    await fx.booking.closeDateSheet();
  });

  test('TC-04: Verify that backing out of the date sheet and the confirmation screen books nothing, and that booking afterwards is confirmed, trackable and correct on the list and detail', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.selectChamber(fx.hybrid);

    await fx.booking.abandonAtDateSheet(); // both exits first: the check is an API count
    await fx.booking.abandonAtConfirmation(appointmentTypes.pickup);
    await expectNoUpcomingBookingWasCreated();

    await fx.booking.openDateSheet();
    await fx.booking.chooseFirstBookableDay();
    await fx.booking.chooseAppointmentType(appointmentTypes.pickup);
    await fx.booking.continueToConfirmation();
    await fx.booking.expectConfirmationShows(fx.doctor.fullName);
    await fx.booking.expectConfirmationShowsChamber(fx.hybrid.name);
    await fx.booking.confirmBooking();

    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);
    await fx.booking.expectSuccessScreenOffersQueueAndTurnTime();

    await fx.booking.openTrackMyQueueFromSuccess();
    await fx.appointments.expectQueueTrackerShowsPosition();
    await fx.booking.leaveTrackMyQueueToSuccess();

    await fx.appointments.expectUpcomingListsAppointmentThenOpenIt(fx.doctor.fullName);
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailMatches({ doctor: fx.doctor, chamber: fx.hybrid, typeLabel: APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.pickup] });

    await fx.appointments.openTrackMyQueue();
    await fx.appointments.expectQueueTrackerShowsPosition();
    await fx.appointments.leaveTrackMyQueue();
  });

  test('TC-05: Verify that booking a slot lowers its remaining count and cancelling restores it', async () => {
    await fx.booking.expectSlotCountFallsAndRecovers(
      await slotCountAcrossBookAndCancel(fx.doctor, fx.defaultChamber),);
  });

  test('TC-06: Verify that cancelling an appointment warns it cannot be undone, removes it from upcoming and leaves the appointment history holding only completed, cancelled or not-shown appointments newest first', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    await fx.appointments.openFreshlyBooked({ reference: fx.seeded.bookingRef });

    await fx.appointments.cancelAppointmentAndExpectWarning();
    await fx.appointments.expectBookingReferenceIsNotListed(fx.seeded.bookingRef);

    await fx.appointments.openPast();
    await fx.appointments.expectPastListIsPopulated();

    await fx.appointments.expectPastIsFinishedAndNewestFirst(await pastAppointmentSummary()); // virtualised list, so purity and order are read from the API
  });

  test("TC-07: Verify that a teleconsultation reaches the detail as a video visit and offers a copyable link", async () => {
    fx.seeded = await seedTeleconsultationFuture(fx.doctor); // today cannot be booked, so the soonest is the next bookable day

    await fx.appointments.openFreshlyBooked({ reference: fx.seeded.bookingRef });
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailShowsType(APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.teleconsultation]);
    await fx.appointments.expectTeleconsultationJoinIsOffered();
    await fx.appointments.copyTeleconsultationLink();
  });

  test('TC-08: Verify that an in-person booking at a non-default chamber records that chamber and offers no join link', async () => {
    await fx.booking.bookThroughApp({ doctor: fx.doctor, type: appointmentTypes.inPerson, chamber: fx.sparseChamber });
    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);

    await fx.appointments.openFreshlyBooked({ chamber: fx.sparseChamber.name });
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailShowsChamber(fx.sparseChamber.name);
    await fx.appointments.expectDetailShowsType(APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.inPerson],);
    await fx.appointments.expectTeleconsultationJoinIsNotOffered();
  });

  test('TC-09: Verify that a pickup booking made through the app is confirmed and reaches the detail as a pickup at that chamber', async () => {
    await fx.booking.bookThroughApp({ doctor: fx.doctor, type: appointmentTypes.pickup, chamber: fx.inPerson });
    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);

    await fx.appointments.openFreshlyBooked({ chamber: fx.inPerson.name });
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailShowsChamber(fx.inPerson.name);
    await fx.appointments.expectDetailShowsType(APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.pickup],);
    await fx.appointments.expectTeleconsultationJoinIsNotOffered();
  });

  test('TC-10: Verify that a follow-up booking made through the app is confirmed and reaches the detail as a follow-up at that chamber', async () => {
    await fx.booking.bookThroughApp({ doctor: fx.doctor, type: appointmentTypes.followUp, chamber: fx.hybrid });
    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);

    await fx.appointments.openFreshlyBooked({ chamber: fx.hybrid.name });
    await fx.appointments.expectDetailStatusIsScheduled();
    await fx.appointments.expectDetailShowsChamber(fx.hybrid.name);
    await fx.appointments.expectDetailShowsType(APPOINTMENT_DETAIL_TYPE_LABEL[appointmentTypes.followUp],);
  });

  test('TC-11: Verify that joining a teleconsultation before its day is refused with the link-not-active notice', async () => {
    fx.seeded = await seedTeleconsultationFuture(fx.doctor);

    await fx.appointments.openFreshlyBooked({ reference: fx.seeded.bookingRef });
    await fx.appointments.expectJoinIsRefusedBeforeTheSession();
  });

  test('TC-12: Verify that Patient Details shows who the booking is for, the locked sign-in mobile number, an empty Notes field and the serial notice', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.selectChamber(fx.hybrid);
    await fx.booking.openDateSheet();
    await fx.booking.chooseFirstBookableDay();
    await fx.booking.expectPatientDetailsAreShown(fx.account);
    await fx.booking.expectAccountHolderIsPreselected();
    await fx.booking.closeDateSheet();
  });

  // Was a known defect (findings/booking.txt): the account holder was listed twice. Reported fixed 2026-09-29.
  test('TC-13: Verify that "Who is this for?" offers each patient on the account exactly once', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.selectChamber(fx.hybrid);
    await fx.booking.openDateSheet();
    await fx.booking.chooseFirstBookableDay();
    await fx.booking.expectEachPatientOfferedOnce(fx.patients);
    await fx.booking.closeDateSheet();
  });

  test('TC-14: Verify that exactly one patient is selected at a time, by default and after choosing another', async () => {
    await fx.booking.openProfileOf(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.selectChamber(fx.hybrid);
    await fx.booking.openDateSheet();
    await fx.booking.chooseFirstBookableDay();
    await fx.booking.expectAccountHolderIsPreselected();
    await fx.booking.chooseAccountHolderAndExpectSingleSelection();
    await fx.booking.closeDateSheet();
  });

  test('TC-15: Verify that a note entered in Patient Details is saved and shown on the appointment detail as the reason for visit', async () => {
    await fx.booking.bookThroughApp({ doctor: fx.doctor, type: appointmentTypes.inPerson, chamber: fx.inPerson, note: fx.note });
    await fx.booking.expectBookingConfirmedFor(fx.doctor.fullName);

    await fx.appointments.openFreshlyBooked({ chamber: fx.inPerson.name });
    await fx.appointments.expectReasonForVisitIs(fx.note);
  });

  test('TC-16: Verify that an appointment booked elsewhere appears on Upcoming after a reload, without restarting the app', async () => {
    await fx.appointments.openUpcomingList();
    fx.seeded = await seedAppointment(fx.doctor); // booked outside the app: API, web, another device
    await fx.appointments.openUpcomingList(); // reload: pull-to-refresh, no restart
    await fx.appointments.expectUpcomingRowShows(fx.seeded, fx.doctor.primarySpeciality);
  });
});
