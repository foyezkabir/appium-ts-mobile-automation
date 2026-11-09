import { startSession, endSession } from './driver';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { BookingPage } from '../pages/booking.page';
import { AppointmentsPage } from '../pages/appointments.page';
import {
  cancelSeeded,
  clearAllUpcoming,
  releaseJoinedAppointments,
  type SeededAppointment,
} from '../api/seed';
import {
  mainDoctor,
  primaryChamber,
  partialWeekChamber,
  teleconsultationChamber,
  inPersonChamber,
  hybridChamber,
} from '../data/fixtures';
import type { ProvisionedDoctor, ProvisionedChamber } from '../api/tenant';
import { getProfile, listPatients, type CustomerProfile, type Patient } from '../api/client';
import { visitNote } from '../data/booking.data';

export type BookingFixture = {
  login: LoginPage;
  nav: NavigationPage;
  booking: BookingPage;
  appointments: AppointmentsPage;
  doctor: ProvisionedDoctor;
  defaultChamber: ProvisionedChamber;
  sparseChamber: ProvisionedChamber;
  videoChamber: ProvisionedChamber;
  inPerson: ProvisionedChamber;
  hybrid: ProvisionedChamber;
  seeded: SeededAppointment | undefined;
  account: CustomerProfile;
  patients: Patient[];
  note: string;
};

// Registers the session, page objects, chamber fixtures and the whole
// setup/teardown cycle, so a spec imports one thing and declares none of it.
// Jest has no test.extend, so the hooks are registered here and the spec reads
// the live values off the returned object.
export function useBooking(): BookingFixture {
  let fx = {} as BookingFixture;

  beforeAll(async () => {
    await startSession();
    fx.login = new LoginPage();
    fx.nav = new NavigationPage();
    fx.booking = new BookingPage();
    fx.appointments = new AppointmentsPage();

    fx.doctor = mainDoctor();
    fx.defaultChamber = primaryChamber();
    fx.sparseChamber = partialWeekChamber();
    fx.videoChamber = teleconsultationChamber();
    fx.inPerson = inPersonChamber();
    fx.hybrid = hybridChamber();
    fx.account = await getProfile();
    fx.patients = (await listPatients()).filter((p) => p.active);
    fx.note = visitNote();

    await clearAllUpcoming();
  });

  afterAll(async () => {
    await clearAllUpcoming();
    await endSession();
  });

  beforeEach(async () => {
    fx.seeded = undefined;
    await clearAllUpcoming(); // one booking per chamber per day
    await fx.nav.goHome();
  });

  afterEach(async () => {
    await cancelSeeded(fx.seeded);
    // A joined teleconsultation can never be cancelled and never releases its
    // chamber-day, so the doctor side completes it.
    await releaseJoinedAppointments(fx.doctor);
  });

  return fx;
}
