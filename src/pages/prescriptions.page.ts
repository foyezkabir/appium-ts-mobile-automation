import { BasePage } from './base.page';
import { d } from '../support/driver';
import { TIMEOUTS } from '../support/config';
import { dayMonthYear, dayMonthYearTime } from '../support/dates';
import {
  PRESCRIPTIONS_TEXT,
  PRESCRIPTIONS_A11Y,
  MEDICINE_ROW,
  DETAIL_SUMMARY,
  PATIENT_GENDER_LABEL,
} from '../locators/prescriptions.locators';
import type { PrescriptionDetail } from '../api/client';
import type { PrescribedMedicine } from '../data/prescriptions.data';

type ServerSummary = { count: number; newestRxNumber: string; oldestRxNumber: string };

// A medicine row's content-desc, split into its columns.
const ROW_PATTERN = new RegExp(
  `^(.*?)\\. (.*?)\\. ${MEDICINE_ROW.dose}(.*)\\. ${MEDICINE_ROW.schedule}(.*)\\. ` +
    `${MEDICINE_ROW.duration}(.*)\\. ${MEDICINE_ROW.instructions}(.*)$`,
);

// The Prescription tab: My Prescriptions, and one prescription's detail.
export class PrescriptionsPage extends BasePage {
  // --------------------------------------------------------------- locators

  private card(rxNumber: string) {
    return this.byA11y(`${PRESCRIPTIONS_A11Y.cardPrefix}${rxNumber}`);
  }

  // Rung 5, positional: the list screen holds exactly ONE input, the search
  // box, and its hint is gone once it holds text. [2026-09-29]
  private get searchField() {
    return this.editTextAt(0);
  }

  private get sortButton() {
    return this.byA11y(PRESCRIPTIONS_A11Y.sort);
  }

  // ---------------------------------------------------------------- reading

  // Rx numbers of the cards on screen, top to bottom.
  private async listedRxNumbers(): Promise<string[]> {
    return (await this.a11yNames())
      .filter((n) => n.startsWith(`${PRESCRIPTIONS_A11Y.cardPrefix}RX-`))
      .map((n) => n.slice(PRESCRIPTIONS_A11Y.cardPrefix.length));
  }

  private countLabel(count: number): string {
    return `${count} ${count === 1 ? PRESCRIPTIONS_TEXT.countSuffixOne : PRESCRIPTIONS_TEXT.countSuffixMany}`;
  }

  private async waitForTopCard(rxNumber: string, why: string) {
    await d().waitUntil(async () => (await this.listedRxNumbers())[0] === rxNumber, {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg: `${why}: expected ${rxNumber} on top, the list shows ${(await this.listedRxNumbers()).join(', ') || 'no card'}.`,
    });
  }

  // ---------------------------------------------------------------- actions

  async openPrescription(rxNumber: string) {
    await this.scrollToA11yPrefix(`${PRESCRIPTIONS_A11Y.cardPrefix}${rxNumber}`);
    await this.tap(this.card(rxNumber), `prescription ${rxNumber}`);
    await this.waitForText(PRESCRIPTIONS_TEXT.medicinesHeading);
  }

  async search(term: string) {
    await this.fill(this.searchField, term, 'prescription search');
    await this.hideKeyboard();
  }

  async clearSearch() {
    await this.searchField.clearValue();
    await this.hideKeyboard();
    await this.waitForText(PRESCRIPTIONS_TEXT.searchHint);
  }

  // A search typed by an earlier test survives the tab switch; start every test from the full list.
  async clearLeftoverSearch() {
    if (await this.isVisible(this.byText(PRESCRIPTIONS_TEXT.searchHint))) return;
    await this.clearSearch();
  }

  async sortBy(option: typeof PRESCRIPTIONS_A11Y.sortMostRecent | typeof PRESCRIPTIONS_A11Y.sortOldestFirst) {
    await this.tap(this.sortButton, 'Sort prescriptions');
    await this.waitForText(PRESCRIPTIONS_TEXT.sortSheetHeading);
    await this.tap(this.byA11y(option), `sort "${option}"`);
    await this.waitGone(this.byText(PRESCRIPTIONS_TEXT.sortSheetHeading), 'the Sort by sheet');
  }

  // -------------------------------------------------------------- guarantees

  // A DRAFT must not reach the patient. The server's issued list is the
  // yardstick: a leaked draft would make the app's count one higher, or put a
  // card on top that the server never issued.
  async expectOnlyIssuedPrescriptionsListed(server: ServerSummary) {
    await this.waitForText(PRESCRIPTIONS_TEXT.listHeading);
    await this.waitForText(this.countLabel(server.count));
    await this.waitForTopCard(server.newestRxNumber, 'The newest card is not the newest ISSUED prescription');
  }

  async expectListedFirstWithChips(p: PrescriptionDetail) {
    await this.waitForTopCard(p.rxNumber, 'The prescription just issued is not listed first under Most recent');
    let texts = await this.textsWithin(this.card(p.rxNumber)); // date, chips, Rx, doctor, "View detail"
    let expected = [dayMonthYear(p.issuedAt), PRESCRIPTIONS_TEXT.statusActive, PRESCRIPTIONS_TEXT.followUpChip, p.rxNumber, p.doctorName];
    let missing = expected.filter((t) => !texts.includes(t));
    if (missing.length > 0) throw new Error(`The card for ${p.rxNumber} lacks ${missing.map((t) => `"${t}"`).join(', ')}; it shows: ${texts.join(' | ')}`);
  }

  // Everything above the medicine table, and the doctor's notes below it.
  async expectDetailShowsRecord(p: PrescriptionDetail) {
    let expected = [
      p.rxNumber,
      PRESCRIPTIONS_TEXT.statusActive,
      PRESCRIPTIONS_TEXT.followUpChip,
      `${p.medicineCount} ${DETAIL_SUMMARY.medicineOne}`,
      `${DETAIL_SUMMARY.issued}${dayMonthYear(p.issuedAt)}`,
      `${DETAIL_SUMMARY.expires}${dayMonthYear(p.expiresAt)}`,
      p.doctorName,
      `${p.doctorSpeciality} · ${p.doctorDesignation}`,
      p.doctorHospital,
      p.doctorDegrees,
      PRESCRIPTIONS_TEXT.issuedLabel,
      dayMonthYearTime(p.issuedAt),
      `${p.patientName} · ${PATIENT_GENDER_LABEL[p.patientGender]} · ${p.patientAge} yrs · ${p.patientBloodGroup}`,
    ];
    for (let text of expected) await this.waitForText(text);

    await this.scrollToText(PRESCRIPTIONS_TEXT.notesHeading);
    await this.waitForText(`${p.medicineCount} ${PRESCRIPTIONS_TEXT.medicinesPrescribedSuffix}`);
    // Observed as the day the consultation was completed, which the seed makes the issue day.
    await this.waitForText(`${PRESCRIPTIONS_TEXT.consultationPrefix}${dayMonthYear(p.issuedAt)}`);
    await this.scrollToText(PRESCRIPTIONS_TEXT.shortNotesLabel);
    await this.waitForText(p.shortNotes);
    await this.scrollToText(PRESCRIPTIONS_TEXT.followUpLabel);
    await this.waitForText(`${PRESCRIPTIONS_TEXT.followUpPrefix}${dayMonthYearTime(p.followUpDatetime ?? '')}.`);
  }

  // Each line as the doctor wrote it. The row's content-desc carries every
  // column, so nothing depends on swiping the table sideways.
  async expectMedicinesAsPrescribed(written: PrescribedMedicine[], p: PrescriptionDetail) {
    let faults: string[] = [];
    for (let medicine of written) {
      await this.scrollToA11yPrefix(`${medicine.brand}. `);
      let row = (await this.a11yNames()).find((n) => n.startsWith(`${medicine.brand}. `)) ?? '';
      let columns = row.match(ROW_PATTERN);
      if (!columns) {
        faults.push(`${medicine.brand}: no medicine row (found "${row}")`);
        continue;
      }
      let [, name, product, dose, schedule, duration, instructions] = columns;
      let server = p.medicines.find((m) => m.productName === medicine.brand);
      let check = (column: string, shown: string, want: string) => {
        if (shown !== want) faults.push(`${name} ${column}: shows "${shown}", expected "${want}"`);
      };
      check('generic · strength', product, `${server?.genericName} · ${medicine.strength}`);
      check('dose', dose, medicine.shows.dose);
      check('schedule', schedule, medicine.shows.schedule);
      check('duration', duration, medicine.shows.duration);
      check('instructions', instructions, medicine.shows.instructions);
    }
    if (faults.length > 0) throw new Error(`Prescribed medicines:\n  - ${faults.join('\n  - ')}`);
  }

  async expectSearchFinds(term: string, rxNumber: string) {
    await this.search(term);
    await this.waitForText(term);
    await d().waitUntil(async () => (await this.listedRxNumbers()).includes(rxNumber), {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg: `Searching "${term}" did not list ${rxNumber}; it lists ${(await this.listedRxNumbers()).join(', ') || 'nothing'}.`,
    });
  }

  async expectSearchFindsOnly(term: string, rxNumber: string) {
    await this.expectSearchFinds(term, rxNumber);
    await this.waitForText(this.countLabel(1));
    let listed = await this.listedRxNumbers();
    if (listed.length !== 1) throw new Error(`Searching the Rx number "${term}" listed ${listed.length} prescriptions: ${listed.join(', ')}.`);
  }

  async expectSearchFindsNothing(term: string) {
    await this.search(term);
    await this.waitForText(PRESCRIPTIONS_TEXT.noMatchHeading);
    await this.waitForText(PRESCRIPTIONS_TEXT.noMatchBody);
    let listed = await this.listedRxNumbers();
    if (listed.length > 0) throw new Error(`"${term}" matches nothing, yet the list shows ${listed.join(', ')}.`);
  }

  async expectOldestFirst(oldestRxNumber: string) {
    await this.sortBy(PRESCRIPTIONS_A11Y.sortOldestFirst);
    await this.waitForTopCard(oldestRxNumber, 'Oldest first does not put the account\'s oldest prescription on top');
  }

  async expectMostRecentFirst(newestRxNumber: string) {
    await this.sortBy(PRESCRIPTIONS_A11Y.sortMostRecent);
    await this.waitForTopCard(newestRxNumber, 'Most recent does not put the newest prescription back on top');
  }
}
