import { usePrescriptions } from '../src/support/prescriptions.fixture';

// Plan: plan/prescriptions.md — every prescription is written by the doctor
// through the API; every assertion is in the customer app.
describe('Prescriptions', () => {
  let fx = usePrescriptions();

  test('TC-01: Verify that a prescription the doctor saved as a draft is not shown, and the list holds only issued prescriptions', async () => {
    await fx.prescriptions.expectOnlyIssuedPrescriptionsListed(fx.server);
  });

  test('TC-02: Verify that the issued prescription is listed first with its Rx number, doctor, issue date, and the Active and Follow Up chips', async () => {
    await fx.prescriptions.expectListedFirstWithChips(fx.prescription);
  });

  test('TC-03: Verify that the prescription detail shows the summary, the doctor, the issued date and time, the patient, the medicine count, the consultation date, the doctor\'s note and the follow-up date and time', async () => {
    await fx.prescriptions.openPrescription(fx.prescription.rxNumber);
    await fx.prescriptions.expectDetailShowsRecord(fx.prescription);
  });

  test('TC-04: Verify that every medicine shows the schedule, duration and instructions the doctor set — every day, every 3 days, set weekdays, days on and off, and every 8 hours', async () => {
    await fx.prescriptions.openPrescription(fx.prescription.rxNumber);
    await fx.prescriptions.expectMedicinesAsPrescribed(fx.medicines, fx.prescription);
  });

  test('TC-05: Verify that search finds the prescription by Rx number, doctor and medicine, and a term matching nothing shows the empty state', async () => {
    await fx.prescriptions.expectSearchFindsOnly(fx.prescription.rxNumber, fx.prescription.rxNumber);
    await fx.prescriptions.expectSearchFinds(fx.prescription.doctorName, fx.prescription.rxNumber);
    await fx.prescriptions.expectSearchFinds(fx.searchMedicine, fx.prescription.rxNumber);
    await fx.prescriptions.expectSearchFindsNothing(fx.noMatch);
    await fx.prescriptions.clearSearch();
  });

  test('TC-06: Verify that Oldest first puts the oldest prescription on top and Most recent puts the new one back on top', async () => {
    await fx.prescriptions.expectOldestFirst(fx.server.oldestRxNumber);
    await fx.prescriptions.expectMostRecentFirst(fx.prescription.rxNumber);
  });
});
