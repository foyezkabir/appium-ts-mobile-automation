import { startSession, endSession } from './driver';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { AppointmentsPage } from '../pages/appointments.page';
import { BookingPage } from '../pages/booking.page';
import { clearAllUpcoming, ensureFinishedAppointmentsExist, type SeededAppointment } from '../api/seed';
import { mainDoctor, inPersonChamber } from '../data/fixtures';
import type { ProvisionedDoctor, ProvisionedChamber } from '../api/tenant';

export type AppointmentsFixture = {
  login: LoginPage;
  nav: NavigationPage;
  appointments: AppointmentsPage;
  booking: BookingPage;
  doctor: ProvisionedDoctor;
  seeded: SeededAppointment | undefined;
  pair: SeededAppointment[];
  // Follow-up needs an in-person, NON-default chamber: the default would be
  // preselected anyway, and a teleconsultation-only chamber offers no Follow-up.
  followUpChamber: ProvisionedChamber;
  completed: SeededAppointment;
};

export function useAppointments(): AppointmentsFixture {
  let fx = {} as AppointmentsFixture;

  beforeAll(async () => {
    await startSession();
    fx.login = new LoginPage();
    fx.nav = new NavigationPage();
    fx.appointments = new AppointmentsPage();
    fx.booking = new BookingPage();
    fx.doctor = mainDoctor();
    fx.followUpChamber = inPersonChamber();
    await ensureFinishedAppointmentsExist(fx.doctor); // reuses, so no leak per run
  });

  afterAll(async () => {
    await clearAllUpcoming();
    await endSession();
  });

  beforeEach(async () => {
    fx.seeded = undefined;
    fx.pair = [];
    await clearAllUpcoming(); // one booking per chamber per day
    await fx.nav.goHome();
  });

  // Every seed here is cancellable, so one sweep covers single and paired seeds.
  afterEach(async () => {
    await clearAllUpcoming();
  });

  return fx;
}
