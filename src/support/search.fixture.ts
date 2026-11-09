import { startSession, endSession } from './driver';
import { LoginPage } from '../pages/login.page';
import { NavigationPage } from '../pages/navigation.page';
import { BookingPage } from '../pages/booking.page';
import {
  mainDoctor,
  otherDoctor,
  searchTerms,
  filterSpecialities,
  filterLocation,
} from '../data/fixtures';
import type { ProvisionedDoctor } from '../api/tenant';

export type SearchFixture = {
  login: LoginPage;
  nav: NavigationPage;
  booking: BookingPage;
  doctor: ProvisionedDoctor;
  other: ProvisionedDoctor;
  terms: ReturnType<typeof searchTerms>;
  specialities: ReturnType<typeof filterSpecialities>;
  location: ReturnType<typeof filterLocation>;
};

export function useSearch(): SearchFixture {
  let fx = {} as SearchFixture;

  beforeAll(async () => {
    await startSession();
    fx.login = new LoginPage();
    fx.nav = new NavigationPage();
    fx.booking = new BookingPage();

    fx.doctor = mainDoctor();
    fx.other = otherDoctor();
    fx.terms = searchTerms();
    fx.specialities = filterSpecialities();
    fx.location = filterLocation();

  });

  afterAll(async () => {
    await endSession();
  });

  beforeEach(async () => {
    await fx.nav.goHome();
    await fx.booking.openFromDashboard();
    await fx.booking.clearDoctorSearch(); // the term survives navigation
  });

  return fx;
}
