import { startSession, endSession } from './driver';
import { NavigationPage } from '../pages/navigation.page';
import { PrescriptionsPage } from '../pages/prescriptions.page';
import {
  clearAllUpcoming,
  seedDraftPrescription,
  seedIssuedPrescription,
  issuedPrescriptionsSummary,
  cancelSeeded,
  cancelFollowUp,
  type SeededAppointment,
  type SeededIssuedPrescription,
} from '../api/seed';
import { prescribingDoctor } from '../data/fixtures';
import { issuedMedicines, issuedNotes, draftMedicines, draftNotes, followUpInDays, searchNoMatch, type PrescribedMedicine } from '../data/prescriptions.data';
import { NAV_A11Y } from '../locators/nav.locators';
import type { PrescriptionDetail } from '../api/client';

export type PrescriptionsFixture = {
  nav: NavigationPage;
  prescriptions: PrescriptionsPage;
  draft: SeededAppointment;
  issued: SeededIssuedPrescription;
  prescription: PrescriptionDetail; // the issued one, as the server holds it
  medicines: PrescribedMedicine[]; // what the doctor wrote on it
  searchMedicine: string;
  server: { count: number; newestRxNumber: string; oldestRxNumber: string };
  noMatch: string;
};

// Seeded ONCE for the file (plan/prescriptions.md): one DRAFT the patient must
// never see, and one issued prescription every other test reads.
// Teardown: the draft's appointment is SCHEDULED and the follow-up is
// upcoming, so both cancel (rung 1). The issued prescription and its COMPLETED
// appointment are PERMANENT — a known leak, not faked away.
export function usePrescriptions(): PrescriptionsFixture {
  let fx = {} as PrescriptionsFixture;

  beforeAll(async () => {
    await startSession();
    fx.nav = new NavigationPage();
    fx.prescriptions = new PrescriptionsPage();

    let doctor = prescribingDoctor();
    await clearAllUpcoming(); // one booking per chamber per day
    fx.draft = await seedDraftPrescription(doctor, { shortNotes: draftNotes, medicines: draftMedicines });
    fx.issued = await seedIssuedPrescription(doctor, { shortNotes: issuedNotes, medicines: issuedMedicines, followUpInDays });
    fx.prescription = fx.issued.prescription;
    fx.medicines = issuedMedicines;
    fx.searchMedicine = issuedMedicines[1].brand;
    fx.server = await issuedPrescriptionsSummary();
    fx.noMatch = searchNoMatch();

    // The tab serves a cached list: on the first run RX-146028-0004 was missing
    // for over 70 s after it was issued (findings/prescriptions.txt). Restart so
    // every test judges what the server holds — the staleness is the finding.
    await fx.prescriptions.restartApp();
  });

  afterAll(async () => {
    await cancelSeeded(fx.draft);
    await cancelFollowUp(fx.issued?.followUpAppointmentId ?? null);
    await endSession();
  });

  beforeEach(async () => {
    await fx.nav.goHome();
    await fx.nav.openTab(NAV_A11Y.prescription);
    await fx.prescriptions.clearLeftoverSearch();
  });

  return fx;
}
