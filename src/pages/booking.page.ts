import type { ChainablePromiseElement } from 'webdriverio';
import { BasePage } from './base.page';
import { d } from '../support/driver';
import { TIMEOUTS } from '../support/config';
import { weekdayLabels, sessionHours } from '../data/fixtures';
import { QUEUE_TEXT } from '../locators/appointments.locators';
import { APPOINTMENT_TYPE, APPOINTMENT_TYPE_DESCRIPTION, CONFIRM_A11Y, CONFIRM_TEXT, DATE_SHEET_A11Y, DATE_SHEET_TEXT, DAY_SUFFIX, DOCTOR_PROFILE_A11Y, DOCTOR_PROFILE_TEXT, MONTH_HEADING_PATTERN, SUCCESS_A11Y, SUCCESS_TEXT, PATIENT_DETAILS_TEXT, PATIENT_DETAILS_FIELD_INDEX } from '../locators/booking.locators';
import { DASHBOARD_A11Y, DASHBOARD_TEXT } from '../locators/dashboard.locators';
import { NAV_A11Y } from '../locators/nav.locators';
import { FILTER_LOCATION_A11Y, FILTER_LOCATION_TEXT, SELECT_DOCTOR_A11Y, SELECT_DOCTOR_FIELD_INDEX, SELECT_DOCTOR_TEXT } from '../locators/search.locators';

export class BookingPage extends BasePage {
  // --------------------------------------------------------------- locators

  private get dashboardBookAppointment() {
    return this.byA11y(DASHBOARD_A11Y.bookAppointment);
  }

  private get selectDoctorHeading() {
    return this.byText(SELECT_DOCTOR_TEXT.heading);
  }

  // The only EditText on Select doctor, so index 0 is unambiguous.
  private get doctorSearchInput() {
    return this.editTextAt(SELECT_DOCTOR_FIELD_INDEX.search);
  }

  private get filtersButton() {
    return this.byA11y(SELECT_DOCTOR_A11Y.filters);
  }

  private get applyFiltersButton() {
    return this.byA11y(SELECT_DOCTOR_A11Y.applyFilters);
  }

  private get resetFiltersButton() {
    return this.byA11y(SELECT_DOCTOR_A11Y.resetFilters);
  }

  private get dismissScrim() {
    return this.byA11y(SELECT_DOCTOR_A11Y.dismissSheet);
  }

  private get noResultsMessage() {
    return this.byText(SELECT_DOCTOR_TEXT.noResults);
  }

  private get doctorProfileHeading() {
    return this.byText(DOCTOR_PROFILE_TEXT.heading);
  }

  private get profileBookAppointment() {
    return this.byA11y(DOCTOR_PROFILE_A11Y.bookAppointment);
  }

  private get dateSheetHeading() {
    return this.byText(DATE_SHEET_TEXT.heading);
  }

  private get continueButton() {
    return this.byA11y(DATE_SHEET_A11Y.continue);
  }

  private get sheetCancelButton() {
    return this.byA11y(DATE_SHEET_A11Y.cancel);
  }

  private get confirmHeading() {
    return this.byText(CONFIRM_TEXT.heading);
  }

  private get confirmBookingButton() {
    return this.byA11y(CONFIRM_A11Y.confirmBooking);
  }

  private get successHeading() {
    return this.byText(SUCCESS_TEXT.heading);
  }

  private get viewMyAppointments() {
    return this.byA11y(SUCCESS_A11Y.viewMyAppointments);
  }

    private doctorCard(name: string, speciality: string): ChainablePromiseElement {
    return this.byA11y(`${name}, ${speciality}`);
  }

  private typeOption(type: (typeof APPOINTMENT_TYPE)[keyof typeof APPOINTMENT_TYPE]) {
    return this.byA11y(type);
  }

  // ---------------------------------------------------------------- actions

    async openFromDashboard() {
    await this.tap(this.dashboardBookAppointment, 'Book Appointment (dashboard)');
    await this.waitVisible(this.selectDoctorHeading, 'Select doctor heading');
  }

  // Dashboard -> doctor picker -> this doctor's profile: the preamble every
  // profile and date-sheet test repeats.
  async openProfileOf(doctorName: string, speciality: string) {
    await this.openFromDashboard();
    await this.searchDoctor(doctorName);
    await this.openDoctorProfile(doctorName, speciality);
  }

  async searchDoctor(term: string) {
    await this.fill(this.doctorSearchInput, term, 'Doctor search input');
    await this.hideKeyboard();
  }

  async clearDoctorSearch() {
    await this.doctorSearchInput.clearValue();
    await this.hideKeyboard();
  }

  async openDoctorProfile(name: string, speciality: string) {
    // The lower doctor cards sit under the floating nav; reach before tapping.
    await this.scrollFieldIntoReach(name);
    await this.tap(this.doctorCard(name, speciality), `doctor card "${name}"`);
    await this.waitVisible(this.doctorProfileHeading, 'Doctor Profile heading');
  }

    async openDateSheet() {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.availableDay);
    await this.tap(this.profileBookAppointment, 'Book Appointment (doctor profile)');
    await this.waitVisible(this.dateSheetHeading, 'date sheet heading');
  }

    async chooseFirstBookableDay(): Promise<string> {
    let dayId = await this.firstBookableDayId();
    await this.tap(this.byA11y(dayId), `calendar day "${dayId}"`);
    return dayId;
  }

  // A teleconsultation link activates at midnight ON the appointment day, so a
  // test about joining must control which day it books rather than take
  // whichever the calendar lists first. The branch lives here, never in a spec.
  async chooseDay(day: 'first' | 'today'): Promise<string> {
    if (day === 'first') return this.chooseFirstBookableDay();
    return this.chooseToday();
  }

  async chooseToday(): Promise<string> {
    let today = new Date().getDate();
    let days = await this.bookableDayIds();
    let match = days.find((id) => Number(id.split(' ')[0]) === today);
    if (!match) {
      throw new Error(
        `Today (${today}) is not bookable on this chamber's calendar. ` +
          `Bookable days: ${days.join(', ') || 'none'}.`,
      );
    }
    await this.tap(this.byA11y(match), `calendar day "${match}"`);
    return match;
  }

    async bookableDayIds(): Promise<string[]> {
    let names = await this.a11yNames();
    return names.filter((n) => n.endsWith(DAY_SUFFIX.bookable));
  }

    async offDayIds(): Promise<string[]> {
    let names = await this.a11yNames();
    return names.filter((n) => n.endsWith(DAY_SUFFIX.off));
  }

  private async firstBookableDayId(): Promise<string> {
    let days = await this.bookableDayIds();
    if (days.length === 0) {
      throw new Error(
        'No bookable day on the visible month: no calendar node ended in " left". ' +
          'The doctor may have no remaining capacity this month — try Next month, ' +
          'or seed a doctor with availability.',
      );
    }
    return days[0];
  }

  async chooseAppointmentType(
    type: (typeof APPOINTMENT_TYPE)[keyof typeof APPOINTMENT_TYPE],
  ) {
    await this.tap(this.typeOption(type), `appointment type "${type}"`);
  }

    async continueToConfirmation() {
    await this.tap(this.continueButton, 'Continue (date sheet)');
    await this.waitVisible(this.confirmHeading, 'Confirm Booking heading');
  }

    async closeDateSheet() {
    await this.tap(this.sheetCancelButton, 'Cancel (date sheet)');
    await this.waitGone(this.dateSheetHeading, 'date sheet');
  }

  // IRREVERSIBLE — creates a real appointment.
  async confirmBooking() {
    await this.tap(this.confirmBookingButton, 'Confirm Booking button');
    await this.waitVisible(this.successHeading, 'Booking confirmed heading');
  }

  async goToMyAppointments() {
    await this.tap(this.viewMyAppointments, 'View My Appointments');
  }

  async goToBookingsTab() {
    await this.tap(this.byA11y(NAV_A11Y.bookings), 'Bookings tab');
  }

    async goBackFromConfirmation() {
    // Waits for the DESTINATION, not for the heading to vanish: "Confirm
    // Booking" also names the button on the doctor profile, so waiting for its
    // absence never settles.
    await this.tap(this.byA11y(CONFIRM_A11Y.goBack), 'Go Back (confirmation)');
    await this.waitVisible(this.doctorProfileHeading, 'Doctor Profile heading');
  }

  // ---------------------------------------------------------------- chambers

  // Switch to a named chamber on the doctor profile.
  async selectChamber(chamber: { name: string; address: string }) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.tap(this.byA11y(DOCTOR_PROFILE_A11Y.selectChamber), 'Select chamber');
    // The sheet row by ACCESSIBILITY ID, never by text. The profile renders the
    // selected chamber's name twice itself (selector button and details card),
    // both ABOVE the sheet, and UiSelector().text() returns the first match in
    // tree order — so tapping by text hits the profile label behind the scrim,
    // dismisses the sheet and silently leaves the chamber unchanged. Only the
    // sheet rows carry content-desc. Verified 2026-09-24.
    await this.tap(this.byA11y(chamber.name), `chamber "${chamber.name}"`);
    await this.waitGone(this.byA11y(chamber.name), 'chamber selector sheet');
    await this.waitForText(chamber.address);
  }

  // ------------------------------------------------------------ filter sheet

  async resetFiltersFromClosedSheet() {
    await this.waitVisible(this.filtersButton, 'Filters button'); // sheet needs a beat to reopen
    await this.tap(this.filtersButton, 'Filters button');
    await this.waitVisible(this.resetFiltersButton, 'Reset button');
    await this.tap(this.resetFiltersButton, 'Reset button');
    await this.tap(this.applyFiltersButton, 'Apply Filters button');
    await this.waitGone(this.applyFiltersButton, 'filter sheet');
  }

  async tapSpecialityChip(speciality: string) {
    await this.scrollChipRowTo(this.byA11y(speciality));
    await this.tap(this.byA11y(speciality), `speciality chip "${speciality}"`);
  }

  async tapAllChip() {
    await this.scrollChipRowTo(this.byA11y(SELECT_DOCTOR_A11Y.allSpecialities));
    await this.tap(this.byA11y(SELECT_DOCTOR_A11Y.allSpecialities), 'All chip');
  }

  async listedSpecialityChips(): Promise<string[]> {
    let names = await this.a11yNames();
    let stop = new Set<string>([
      SELECT_DOCTOR_A11Y.filters,
      ...Object.values(NAV_A11Y) as string[],
    ]);
    return names.filter((n) => !stop.has(n) && !n.includes(', '));
  }

  async expectSpecialityChipsAreOffered(chips: string[]) {
    for (let chip of chips) {
      await this.scrollChipRowTo(this.byA11y(chip));
      await this.waitVisible(this.byA11y(chip), `speciality chip "${chip}"`);
    }
  }

  async selectDivision(division: string) {
    await this.tap(this.byA11y(FILTER_LOCATION_A11Y.division), 'Division dropdown');
    await this.tap(this.byText(division), `division "${division}"`);
    await this.waitForText(division);
  }

  async selectDistrict(district: string) {
    await this.tap(this.byA11y(FILTER_LOCATION_A11Y.district), 'District dropdown');
    await this.tap(this.byText(district), `district "${district}"`);
  }

  async expectLocationSectionIsShown() {
    await this.scrollFieldIntoReach(FILTER_LOCATION_TEXT.selectDivision); // Location sits under the speciality chips, below the fold
    await this.waitForText(FILTER_LOCATION_TEXT.sectionHeading);
    await this.waitForText(FILTER_LOCATION_TEXT.divisionLabel);
    await this.waitForText(FILTER_LOCATION_TEXT.selectDivision); // the "Choose a division to reveal District…" hint was dropped (device-verified 2026-10-07)
    await this.waitVisible(this.byA11y(FILTER_LOCATION_A11Y.division), 'Division dropdown');
  }

  async expectDistrictBecameAvailable() {
    await this.scrollFieldIntoReach(FILTER_LOCATION_TEXT.selectDistrict);
    await this.waitForText(FILTER_LOCATION_TEXT.districtLabel);
    await this.waitForText(FILTER_LOCATION_TEXT.districtHint);
    await this.waitVisible(this.byA11y(FILTER_LOCATION_A11Y.district), 'District dropdown');
  }

  async openFilters() {
    await this.tap(this.filtersButton, 'Filters button');
    await this.waitVisible(this.applyFiltersButton, 'Apply Filters button');
  }

  async selectSpeciality(speciality: string) {
    let chip = this.byA11y(speciality);
    await this.tap(chip, `speciality "${speciality}"`);

    // The chip is a Button with checkable="false", so it tracks selection in
    // `selected`, not `checked`. Confirm the tap registered before applying —
    // a missed chip makes Apply look like a broken filter.
    await d().waitUntil(async () => (await chip.getAttribute('selected')) === 'true', {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: `Speciality "${speciality}" did not become selected after tapping it.`,
    });
  }

  // Close the filter sheet by applying.
  async applyFilters() {
    await this.tap(this.applyFiltersButton, 'Apply Filters button');
    await this.waitGone(this.applyFiltersButton, 'filter sheet');
  }

  async resetFilters() {
    // Reset APPLIES and closes the sheet on its own — no Apply tap follows.
    await this.tap(this.resetFiltersButton, 'Reset button');
    await this.waitGone(this.applyFiltersButton, 'filter sheet');
  }

  async clearFilterViaSheet() {
    await this.openFilters();
    await this.resetFilters();
  }

  async expectSpecialityIsNotSelectedInSheet(speciality: string) {
    let chip = this.byA11y(speciality);
    await d().waitUntil(async () => (await chip.getAttribute('selected')) !== 'true', {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: `"${speciality}" was still selected after choosing another speciality.`,
    });
  }

  async expectSpecialityIsSelectedInSheet(speciality: string) {
    let chip = this.byA11y(speciality);
    await this.waitVisible(chip, `speciality "${speciality}" in the filter sheet`);
    await d().waitUntil(async () => (await chip.getAttribute('selected')) === 'true', {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: `The filter sheet did not show "${speciality}" as selected.`,
    });
  }

  // -------------------------------------------------------------- guarantees

  async expectSelectDoctorIsOpen() {
    await this.waitVisible(this.selectDoctorHeading, 'Select doctor heading');
    await this.waitForText(SELECT_DOCTOR_TEXT.subheading);
  }

  async expectDoctorCardShowsCredentials(doctor: {
    fullName: string;
    primarySpeciality: string;
    designation: string;
    formerPosition: string;
    attachedHospital: string;
    experienceYears: number;
    bmdcRegNo: string;
  }) {
    await this.scrollFieldIntoReach(doctor.fullName);
    await this.waitForText(doctor.fullName);
    await this.waitForText(doctor.primarySpeciality);
    await this.waitForText(doctor.designation);
    await this.waitForText(doctor.formerPosition);
    await this.waitForText(doctor.attachedHospital);
    await this.waitForText(`${doctor.experienceYears}+ ${DOCTOR_PROFILE_TEXT.experienceSuffix}`);
    await this.waitForText(`${DOCTOR_PROFILE_TEXT.bmdcPrefix} ${doctor.bmdcRegNo}`);
  }

  async countDoctorPhotos(): Promise<number> {
    let source = await this.decodedPageSource();
    return (source.match(/android\.widget\.ImageView/g) ?? []).length;
  }

  async expectEveryDoctorCardHasAPhoto(expectedCards: number) {
    // The photos carry no accessibility description, so they cannot be tied to
    // a named doctor — only counted against the number of cards on screen.
    await d().waitUntil(async () => (await this.countDoctorPhotos()) >= expectedCards, {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg: `Fewer doctor photos than the ${expectedCards} cards listed.`,
    });
  }

  async expectDoctorIsListed(name: string, speciality: string) {
    await this.waitVisible(this.doctorCard(name, speciality), `doctor card "${name}"`);
  }

  async expectDoctorIsNotListed(name: string, speciality: string) {
    await this.waitGone(this.doctorCard(name, speciality), `doctor card "${name}"`);
  }

  // The placeholder shows only while the field is empty, so it is read after clearing.
  async expectSearchPlaceholderIsNameOnly() {
    await this.clearDoctorSearch();
    await this.waitForText(SELECT_DOCTOR_TEXT.searchPlaceholder);
  }

  async expectNoDoctorsFound() {
    await this.waitVisible(this.noResultsMessage, 'no-results message');
  }

  async expectDoctorProfileIsOpen(name: string) {
    await this.waitVisible(this.doctorProfileHeading, 'Doctor Profile heading');
    await this.waitForText(name);
  }

  // The fee table's LABELS are fixed copy; the amounts are per-doctor data.
  async expectVisitChargesAreShown() {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.visitCharges);
    await this.waitForText(DOCTOR_PROFILE_TEXT.visitCharges);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeFirstVisit);
  }

  async isContinueEnabled(): Promise<boolean> {
    await this.waitVisible(this.continueButton, 'Continue button');
    return (await this.continueButton.getAttribute('enabled')) === 'true';
  }

  async expectContinueIsDisabled() {
    await d().waitUntil(async () => !(await this.isContinueEnabled()), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Continue was enabled before a day had been chosen.',
    });
  }

  async expectContinueIsEnabled() {
    await d().waitUntil(async () => this.isContinueEnabled(), {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: 'Continue stayed disabled after a day was chosen.',
    });
  }

  async expectPreviousMonthIsDisabled() {
    let previous = this.byA11y(DATE_SHEET_A11Y.previousMonth);
    await this.waitVisible(previous, 'Previous month button');
    if ((await previous.getAttribute('enabled')) === 'true') {
      throw new Error('Previous month was enabled on the current month.');
    }
  }

  async expectNextMonthIsEnabled() {
    let next = this.byA11y(DATE_SHEET_A11Y.nextMonth);
    await this.waitVisible(next, 'Next month button');
    if ((await next.getAttribute('enabled')) !== 'true') {
      throw new Error('Next month was disabled, so the calendar cannot advance.');
    }
  }

  async goToNextMonth() {
    let before = await this.monthHeading();
    await this.tap(this.byA11y(DATE_SHEET_A11Y.nextMonth), 'Next month');
    await d().waitUntil(async () => (await this.monthHeading()) !== before, {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: `The calendar stayed on "${before}" after tapping Next month.`,
    });
  }

  async monthHeading(): Promise<string> {
    let texts = await this.visibleTexts();
    let heading = texts.find((t) => MONTH_HEADING_PATTERN.test(t));
    if (!heading) throw new Error('No month heading (e.g. "September 2026") on the date sheet.');
    return heading;
  }

  async expectCurrentMonthIsShown() {
    let expected = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    let actual = await this.monthHeading();
    if (actual !== expected) {
      throw new Error(`The calendar opened on "${actual}", not the current month "${expected}".`);
    }
  }

  async expectMonthIsNotCurrent() {
    let current = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    let actual = await this.monthHeading();
    if (actual === current) {
      throw new Error(`The calendar is still on "${current}" after advancing a month.`);
    }
  }

  // A bookable day renders "<n> left"; a past day renders the number alone.
  async expectPastDaysAreNotBookable() {
    let today = new Date().getDate();
    let bookable = await this.bookableDayNumbers();
    let past = bookable.filter((day) => day < today);
    if (past.length > 0) {
      throw new Error(
        `Days ${past.join(', ')} are before today (${today}) yet offer capacity.`,
      );
    }
  }

  private async bookableDayNumbers(): Promise<number[]> {
    let names = await this.a11yNames();
    return names
      .filter((name) => name.endsWith(DAY_SUFFIX.bookable))
      .map((name) => Number(name.split(' ')[0]))
      .filter((day) => Number.isFinite(day));
  }

  async expectAppointmentTypeDescriptionsAreShown() {
    for (let description of Object.values(APPOINTMENT_TYPE_DESCRIPTION)) {
      await this.waitForText(description);
    }
  }

  // Session length / avg consultation time — proves the calendar re-rendered
  // for this chamber rather than keeping the previous one's grid.
  async expectRemainingCapacityMatches(chamber: {
    name: string;
    sessionStart: string;
    sessionEnd: string;
    avgConsultationTime: number;
  }) {
    let minutes =
      (Number(chamber.sessionEnd.slice(0, 2)) - Number(chamber.sessionStart.slice(0, 2))) * 60 +
      (Number(chamber.sessionEnd.slice(3, 5)) - Number(chamber.sessionStart.slice(3, 5)));
    let capacity = Math.floor(minutes / chamber.avgConsultationTime);

    let names = await this.a11yNames();
    let labels = names.filter((name) => name.endsWith(DAY_SUFFIX.bookable));
    if (labels.length === 0) {
      throw new Error(`No bookable day on the calendar for "${chamber.name}".`);
    }
    let over = labels
      .map((label) => ({ label, remaining: Number(label.match(/(\d+) left/)?.[1]) }))
      .filter((d) => Number.isFinite(d.remaining) && d.remaining > capacity);
    if (over.length > 0) {
      throw new Error(
        `"${chamber.name}" seats ${capacity} per day, but the calendar offers more: ` +
          over.map((d) => d.label).join(', '),
      );
    }
  }

  async openTrackMyQueueFromSuccess() {
    await this.tap(this.byA11y(SUCCESS_A11Y.trackMyQueue), 'Track My Queue (success screen)');
    await this.waitForText(QUEUE_TEXT.heading);
  }

  // Back from a queue opened on the success screen lands on the SUCCESS screen,
  // not the appointment detail — each entry point has its own exit.
  async leaveTrackMyQueueToSuccess() {
    await this.goBack();
    await this.waitVisible(this.successHeading, 'Booking confirmed heading');
  }

  async expectSuccessScreenOffersQueueAndTurnTime() {
    await this.waitForText(SUCCESS_TEXT.estTurnTime);
    await this.waitVisible(this.byA11y(SUCCESS_A11Y.trackMyQueue), 'Track My Queue');
    await this.waitVisible(this.viewMyAppointments, 'View My Appointments');
    await this.waitForText(SUCCESS_TEXT.smsNotice);
  }

  async serialNumberOnSuccess(): Promise<number> {
    let texts = await this.visibleTexts();
    let serial = texts.map((t) => t.match(/Serial #(\d+)/)).find((m) => m !== null);
    if (!serial) throw new Error('No "Serial #n" on the booking confirmation screen.');
    return Number(serial[1]);
  }

  async expectDateSheetIsOpen() {
    await this.waitVisible(this.dateSheetHeading, 'date sheet heading');
    await this.waitForText(DATE_SHEET_TEXT.subheading);
  }

  async expectDateSheetIsClosed() {
    await this.waitGone(this.dateSheetHeading, 'date sheet');
  }

  // Every appointment type the app offers is selectable on the sheet.
  // Asserts BOTH directions: checking only the enabled ones would pass on a
  // screen that enabled all four regardless of chamber.
  async expectTypesEnabledForChamber(enabledTypes: readonly string[]) {
    let wrong: string[] = [];
    for (let type of Object.values(APPOINTMENT_TYPE)) {
      let option = this.typeOption(type);
      await this.waitVisible(option, `appointment type "${type}"`);
      let expected = enabledTypes.includes(type);
      let actual = await option.isEnabled();
      if (actual !== expected) {
        wrong.push(`"${type}" expected ${expected ? 'enabled' : 'disabled'}, was ${actual ? 'enabled' : 'disabled'}`);
      }
    }
    if (wrong.length > 0) {
      throw new Error(`Appointment-type radios wrong for this chamber: ${wrong.join('; ')}.`);
    }
  }

  // Everything the profile and its date sheet must show for ONE chamber. Lives
  // here because it runs once per chamber type — a loop in a spec is banned, and
  // so is a multi-step helper that carries assertions.
  async expectChamberRendersEverywhere(
    chamber: {
      name: string;
      address: string;
      phone: string;
      fees: Parameters<BookingPage['expectVisitChargesMatch']>[0];
      daysOfWeek: string[];
      sessionStart: string;
      sessionEnd: string;
      avgConsultationTime: number;
    },
    enabledTypes: readonly string[],
  ) {
    await this.selectChamber(chamber);
    await this.expectChamberIsSelected(chamber.name);
    await this.expectChamberDetailsAreShown(chamber);
    await this.expectVisitChargesMatch(chamber.fees);
    await this.expectAvailableDaysAreShown(
      weekdayLabels(chamber.daysOfWeek),
      sessionHours(chamber.sessionStart, chamber.sessionEnd),
    );

    await this.openDateSheet();
    await this.expectAllAppointmentTypesOffered();
    await this.expectAppointmentTypeDescriptionsAreShown();
    await this.chooseFirstBookableDay();
    await this.expectTypesEnabledForChamber(enabledTypes);
    await this.expectRemainingCapacityMatches(chamber);
    await this.closeDateSheet();
  }

  // Pick a day and type, reach confirmation, then back out. Proves an abandoned
  // attempt creates nothing; the caller asserts that against the API.
  async abandonAtConfirmation(type: (typeof APPOINTMENT_TYPE)[keyof typeof APPOINTMENT_TYPE]) {
    await this.openDateSheet();
    await this.chooseFirstBookableDay();
    await this.chooseAppointmentType(type);
    await this.continueToConfirmation();
    await this.goBackFromConfirmation();
  }

  // Open the date sheet, pick a day, then close it without continuing.
  async abandonAtDateSheet() {
    await this.openDateSheet();
    await this.chooseFirstBookableDay();
    await this.closeDateSheet();
    await this.expectDateSheetIsClosed();
  }

  // The whole booking wizard, doctor picker to confirmation.
  async bookThroughApp(input: {
    doctor: { fullName: string; primarySpeciality: string };
    type: (typeof APPOINTMENT_TYPE)[keyof typeof APPOINTMENT_TYPE];
    chamber: { name: string; address: string };
    day?: 'first' | 'today';
    note?: string;
  }) {
    await this.openProfileOf(input.doctor.fullName, input.doctor.primarySpeciality);
    await this.selectChamber(input.chamber);
    await this.openDateSheet();
    await this.chooseDay(input.day ?? 'first');
    await this.chooseAppointmentType(input.type);
    if (input.note) await this.enterVisitNotes(input.note);
    await this.continueToConfirmation();
    await this.expectConfirmationShowsChamber(input.chamber.name);
    await this.confirmBooking();
  }

  // ------------------------------------------------------- patient details

  private get notesInput() {
    return this.editTextAt(PATIENT_DETAILS_FIELD_INDEX.notes);
  }

  private get mobileInput() {
    return this.editTextAt(PATIENT_DETAILS_FIELD_INDEX.mobile);
  }

  async scrollToPatientDetails() {
    await this.scrollToText(PATIENT_DETAILS_TEXT.whoFor);
  }

  // The locked field shows the account phone without its leading 0 ("1783-367056"
  // for 01783367056), so the comparison is on digits.
  async expectPatientDetailsAreShown(account: { phone: string }) {
    await this.scrollToPatientDetails();
    await this.waitForText(PATIENT_DETAILS_TEXT.heading);
    await this.waitForText(PATIENT_DETAILS_TEXT.subheading);
    await this.waitForText(PATIENT_DETAILS_TEXT.whoFor);
    await this.waitForText(PATIENT_DETAILS_TEXT.mobileLabel);
    await this.waitForText(PATIENT_DETAILS_TEXT.countryCode);
    await this.waitForText(PATIENT_DETAILS_TEXT.mobileLockedHint);
    await this.waitForText(PATIENT_DETAILS_TEXT.notesLabel);
    await this.waitForText(PATIENT_DETAILS_TEXT.notesPlaceholder);
    await this.waitForText(PATIENT_DETAILS_TEXT.serialHint);

    let shown = (await this.mobileInput.getText()).replace(/\D/g, '');
    let expected = account.phone.replace(/\D/g, '').replace(/^0/, '');
    if (shown !== expected) {
      throw new Error(`The locked mobile shows "${shown}", but the account phone is "${expected}".`);
    }
    if (await this.mobileInput.isEnabled()) {
      throw new Error('The mobile number field is editable, but it is the sign-in number.');
    }
  }

  // Counts each patient's option by a11y id. Every option carries the patient's
  // full name, so a name offered twice is two identical, indistinguishable choices.
  async expectEachPatientOfferedOnce(patients: Array<{ firstName: string; lastName: string; relation: string }>) {
    await this.scrollToPatientDetails();
    let names = await this.a11yNames();
    let wrong = patients
      .map((p) => (p.relation === 'SELF' ? PATIENT_DETAILS_TEXT.accountHolder : `${p.firstName} ${p.lastName}`))
      .map((name) => ({ name, count: names.filter((n) => n === name).length }))
      .filter((p) => p.count !== 1);
    if (wrong.length > 0) {
      throw new Error(
        `"Who is this for?" must offer each patient once: ` +
          wrong.map((p) => `"${p.name}" offered ${p.count} times`).join('; '),
      );
    }
  }

  private async patientOptionStates(name: string): Promise<boolean[]> {
    let options = Array.from(await this.allByA11yPrefix(name));
    let states: boolean[] = [];
    for (let option of options) states.push((await option.getAttribute('selected')) === 'true');
    return states;
  }

  // Radios report their state through "selected", not "checked" — verified on device.
  async expectAccountHolderIsPreselected() {
    let name = PATIENT_DETAILS_TEXT.accountHolder;
    await this.scrollToPatientDetails();
    let states = await this.patientOptionStates(name);
    if (states[0] !== true || states.filter(Boolean).length !== 1) {
      throw new Error(`Expected the first "${name}" option alone to be pre-selected; states were [${states}].`);
    }
  }

  // Taps the LAST option carrying this name and proves exactly one stays selected.
  async chooseAccountHolderAndExpectSingleSelection() {
    let name = PATIENT_DETAILS_TEXT.accountHolder;
    await this.scrollToPatientDetails();
    let options = Array.from(await this.allByA11yPrefix(name));
    let last = options[options.length - 1];
    if (!last) throw new Error(`No "${name}" option under "Who is this for?".`);
    await last.click();

    let states = await this.patientOptionStates(name);
    if (states[states.length - 1] !== true || states.filter(Boolean).length !== 1) {
      throw new Error(`After tapping the last "${name}" option, selection states were [${states}].`);
    }
  }

  // Never hides the keyboard: on this sheet hideKeyboard() is delivered as Back
  // and closes the whole modal, discarding the choices. Continue stays reachable
  // with the keyboard up — verified 2026-09-24.
  async enterVisitNotes(note: string) {
    await this.scrollToText(PATIENT_DETAILS_TEXT.notesLabel);
    await this.notesInput.click();
    await this.notesInput.setValue(note);
  }

  // Follow-up arrives PRE-SELECTED when the booking starts from a completed
  // appointment's "Book follow-up", and it is the only type selected.
  async expectFollowUpIsPreselected() {
    let selected: string[] = [];
    for (let type of Object.values(APPOINTMENT_TYPE)) {
      if ((await this.typeOption(type).getAttribute('selected')) === 'true') selected.push(type);
    }
    if (selected.length !== 1 || selected[0] !== APPOINTMENT_TYPE.followUp) {
      throw new Error(`Expected only "${APPOINTMENT_TYPE.followUp}" pre-selected; selected: [${selected.join(', ')}].`);
    }
  }

  async expectAllAppointmentTypesOffered() {
    await this.waitVisible(this.typeOption(APPOINTMENT_TYPE.inPerson), 'In-Person option');
    await this.waitVisible(
      this.typeOption(APPOINTMENT_TYPE.teleconsultation),
      'Teleconsultation option',
    );
    await this.waitVisible(this.typeOption(APPOINTMENT_TYPE.pickup), 'Pickup option');
    await this.waitVisible(this.typeOption(APPOINTMENT_TYPE.followUp), 'Follow-up option');
  }

  async expectAtLeastOneBookableDay() {
    await d().waitUntil(async () => (await this.bookableDayIds()).length > 0, {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg:
        'No calendar day offered remaining capacity (no accessibility id ended in " left").',
    });
  }

  // The calendar marks some days as the doctor's off days.
  async expectSomeDaysAreOff() {
    await d().waitUntil(async () => (await this.offDayIds()).length > 0, {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg:
        'No calendar day was marked off (no accessibility id ended in ", Off") for a doctor ' +
        'whose calendar was sparse when crawled on 2026-09-21.',
    });
  }

  async expectConfirmationShows(doctorName: string) {
    await this.waitVisible(this.confirmHeading, 'Confirm Booking heading');
    await this.waitForText(CONFIRM_TEXT.detailsHeading);
    await this.waitForText(doctorName);
    await this.waitForText(CONFIRM_TEXT.estimatedSerial);
  }

  async expectBookingConfirmed() {
    await this.waitVisible(this.successHeading, 'Booking confirmed heading');
    await this.waitForText(SUCCESS_TEXT.smsNotice);
  }

  async expectBookingConfirmedFor(doctorName: string) {
    await this.expectBookingConfirmed();
    await this.waitForText(doctorName);
  }

  async expectDashboardIsOpen() {
    await this.waitForText(DASHBOARD_TEXT.glanceSubheading);
  }

  // BMDC registration and years of experience — the two credentials a patient judges a doctor by.
  async expectCredentialsAreShown() {
    await this.waitForText(DOCTOR_PROFILE_TEXT.bmdcPrefix);
    await this.waitForText(DOCTOR_PROFILE_TEXT.experienceSuffix);
  }

  async expectChamberSelectorIsShown() {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.waitForText(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.waitVisible(
      this.byA11y(DOCTOR_PROFILE_A11Y.selectChamber),
      'chamber selector',
    );
  }

  async expectEveryChamberIsOffered(chamberNames: string[]) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.tap(this.byA11y(DOCTOR_PROFILE_A11Y.selectChamber), 'Select chamber');
    for (let name of chamberNames) {
      await this.scrollToText(name);
      await this.waitForText(name);
    }
    await this.goBack(); // close the selector without changing the chamber
  }

  // Takes the measured cycle, so the spec holds no intermediate counts.
  async expectSlotCountFallsAndRecovers(counts: {
    before: number;
    afterBooking: number;
    afterCancel: number;
  }) {
    await this.expectSlotCountDropped(counts.before, counts.afterBooking);
    await this.expectSlotCountRestored(counts.before, counts.afterCancel);
  }

  async expectSlotCountDropped(before: number, after: number) {
    if (after !== before - 1) {
      throw new Error(
        `Remaining slots went ${before} -> ${after}; a booking should drop it by exactly one.`,
      );
    }
  }

  async expectSlotCountRestored(before: number, after: number) {
    if (after !== before) {
      throw new Error(
        `Remaining slots went ${before} -> ${after}; a cancellation should restore the original count.`,
      );
    }
  }

  async expectChamberDetailsAreShown(chamber: {
    name: string;
    address: string;
    phone: string;
  }) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.waitForText(chamber.name);
    await this.waitForText(chamber.address);
    await this.waitForText(chamber.phone);
    await this.waitForText(DOCTOR_PROFILE_TEXT.chamberActive);
  }

  async expectVisitChargesMatch(fees: {
    feeFirstVisit: number;
    feeReportView: number;
    feeSecondVisitWithinMonth: number;
    feeSecondVisitAfterMonth: number;
  }) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.visitCharges);
    for (let amount of [
      fees.feeFirstVisit,
      fees.feeReportView,
      fees.feeSecondVisitWithinMonth,
      fees.feeSecondVisitAfterMonth,
    ]) {
      await this.waitForText(`${DOCTOR_PROFILE_TEXT.currency} ${amount.toLocaleString('en-US')}`);
    }
  }

  async expectFeeLabelsAndHintsAreShown() {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.visitCharges);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeFirstVisit);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeFirstVisitHint);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeReportView);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeReportViewHint);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeSecondVisit);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeSecondVisitHint);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeAfterOneMonth);
    await this.waitForText(DOCTOR_PROFILE_TEXT.feeAfterMonthHint);
  }

  // Formats from the chamber itself, so a spec never derives display strings.
  async expectChamberScheduleIsShown(chamber: {
    daysOfWeek: string[];
    sessionStart: string;
    sessionEnd: string;
  }) {
    await this.expectAvailableDaysAreShown(
      weekdayLabels(chamber.daysOfWeek),
      sessionHours(chamber.sessionStart, chamber.sessionEnd),
    );
  }

  async expectAvailableDaysAreShown(days: string[], hours: string) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.availableDay);
    for (let day of days) {
      await this.waitForText(day);
    }
    await this.waitForText(hours);
  }

  async expectChamberIsSelected(chamberName: string) {
    await this.scrollFieldIntoReach(DOCTOR_PROFILE_TEXT.selectChamber);
    await this.waitForText(chamberName);
  }

  async expectFilterSheetIsOpen() {
    await this.waitVisible(this.applyFiltersButton, 'Apply Filters button');
    await this.waitVisible(this.resetFiltersButton, 'Reset button');
  }

  async expectFilterSheetIsClosed() {
    await this.waitGone(this.applyFiltersButton, 'filter sheet');
  }

  async expectConfirmationShowsChamber(chamberName: string) {
    await this.waitVisible(this.confirmHeading, 'Confirm Booking heading');
    await this.waitForText(chamberName);
  }
}
