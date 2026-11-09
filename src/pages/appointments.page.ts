import type { ChainablePromiseElement } from 'webdriverio';
import { BasePage } from './base.page';
import { d, waitForClipboardOverlayToClose } from '../support/driver';
import { TIMEOUTS } from '../support/config';
import { APPOINTMENTS_A11Y, APPOINTMENTS_TEXT, APPOINTMENT_DETAIL_A11Y, APPOINTMENT_DETAIL_TEXT, APPOINTMENT_ROW_PREFIX, BOOKING_REF_PATTERN, CANCEL_SHEET_A11Y, CANCEL_SHEET_TEXT, QUEUE_TEXT, QUEUE_TOKEN_PATTERN, TELECONSULTATION_DETAIL_TEXT, TELECONSULTATION_JOIN_WEB, ROW_STAMP_PATTERN, ROW_STAMP_PARTS } from '../locators/appointments.locators';

// Chips a row can show between its speciality and its status; device-verified 2026-10-07 on a teleconsultation row.
// The Past tab is the appointment HISTORY: an appointment lands there once it is completed, cancelled or
// not shown — whatever its date, so a cancelled FUTURE booking is history too.
const HISTORY_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
const VISIT_TYPE_CHIPS = ['Teleconsultation', 'In-Person Visit', 'In-Person', 'Follow-up', 'Pickup'];
const PAST_ROW_STAMP = /^\d{1,2} [A-Z][a-z]{2} \d{4} · \d{1,2}:\d{2} [AP]M$/;
import { NAV_A11Y } from '../locators/nav.locators';
import { DOCTOR_PROFILE_TEXT } from '../locators/booking.locators';
import { localDate } from '../support/dates';

// My Appointments — the Bookings tab, the appointment detail route, and the cancellation sheet.
export class AppointmentsPage extends BasePage {
  // --------------------------------------------------------------- locators

  private get heading() {
    return this.byText(APPOINTMENTS_TEXT.heading);
  }

  private get upcomingTab() {
    return this.byA11y(APPOINTMENTS_A11Y.upcomingTab);
  }

  private get pastTab() {
    return this.byA11y(APPOINTMENTS_A11Y.pastTab);
  }

  private get detailHeading() {
    return this.byText(APPOINTMENT_DETAIL_TEXT.heading);
  }

  private get trackMyQueueButton() {
    return this.byA11y(APPOINTMENT_DETAIL_A11Y.trackMyQueue);
  }

  private get cancelAppointmentButton() {
    return this.byA11y(APPOINTMENT_DETAIL_A11Y.cancelAppointment);
  }

  private get confirmCancellationButton() {
    return this.byA11y(CANCEL_SHEET_A11Y.confirmCancellation);
  }

  private get cancelSheetHeading() {
    return this.byText(CANCEL_SHEET_TEXT.heading);
  }

  // A row's a11y id is "Appointment with <doctor name>".
  private appointmentRow(doctorName: string): ChainablePromiseElement {
    return this.byA11y(`${APPOINTMENT_ROW_PREFIX}${doctorName}`);
  }

  // ---------------------------------------------------------------- actions

  async openUpcoming() {
    await this.tap(this.upcomingTab, 'Upcoming tab');
  }

  async openPast() {
    await this.tap(this.pastTab, 'Past tab');
  }

  // Past is its own list and is NOT refreshed by pulling Upcoming — each list
  // needs its own pull-down before it is read.
  async openPastRefreshed() {
    await this.openPast();
    await this.pullToRefresh();
  }

  // List rows show doctor, date and serial — never the booking reference or the
  // chamber, which live only on the detail. So open each row in turn and keep
  // the one whose detail carries `marker`.
  //
  // Rows are tapped BY INDEX, never by their accessibility id: every row for one
  // doctor carries the identical id "Appointment with <name>", and byA11y
  // returns the first match — so tapping by name reopens row 1 forever and a
  // second appointment can never be reached.
  private async openAppointmentWhoseDetailContains(marker: string, describedAs: string) {
    let rowCount = (await this.a11yNames()).filter((n) =>
      n.startsWith(APPOINTMENT_ROW_PREFIX),
    ).length;

    for (let index = 0; index < rowCount; index += 1) {
      let row = (await this.allByA11yPrefix(APPOINTMENT_ROW_PREFIX))[index];
      if (!row) break;

      await row.click();
      await this.waitVisible(this.detailHeading, 'Appointment detail heading');

      if ((await this.decodedPageSource()).includes(marker)) return;
      await this.goBack();
      await this.waitVisible(this.heading, 'My Appointments heading');
    }

    throw new Error(`No appointment row opened to ${describedAs} "${marker}".`);
  }

  // A RELOAD, not a restart: pull-to-refresh on Upcoming. Measured 2026-09-25:
  // after an API booking, switching Past -> Upcoming left the list stale, and
  // entering Bookings from another screen does too (DEF-05); a pull-down
  // showed the new row. Steps back first when the screen has no tab bar, e.g.
  // the booking success screen.
  async openUpcomingList() {
    for (let i = 0; i < 4 && !(await this.isVisible(this.byA11y(NAV_A11Y.bookings))); i += 1) {
      await this.goBack();
    }
    await this.tap(this.byA11y(NAV_A11Y.bookings), 'Bookings tab');
    await this.expectBothTabsAreOffered();
    await this.openUpcoming();
    await this.pullToRefresh();
  }

  async openFreshlyBooked(by: { reference: string } | { chamber: string } | { doctor: string }) {
    await this.openUpcomingList();

    if ('reference' in by) return this.openAppointmentByReference(by.reference);
    if ('chamber' in by) return this.openAppointmentByChamber(by.chamber);
    return this.openAppointment(by.doctor);
  }

  // TC-04 proves the booking REACHES the list before opening it, so the listing
  // assertion has to run inside the navigation rather than after it.
  async expectUpcomingListsAppointmentThenOpenIt(doctorName: string) {
    await this.openUpcomingList();
    await this.expectAppointmentIsListed(doctorName);
    await this.openAppointment(doctorName);
  }

  async openAppointmentByReference(bookingRef: string) {
    await this.openAppointmentWhoseDetailContains(bookingRef, 'booking reference');
  }

  async openAppointmentByChamber(chamberName: string) {
    await this.openAppointmentWhoseDetailContains(chamberName, 'chamber');
  }

  async openAppointment(doctorName: string) {
    await this.scrollFieldIntoReach(doctorName);
    await this.tap(this.appointmentRow(doctorName), `appointment row "${doctorName}"`);
    await this.waitVisible(this.detailHeading, 'Appointment detail heading');
  }

  // How many upcoming rows are on screen for this doctor.
  async countRowsFor(doctorName: string): Promise<number> {
    let names = await this.a11yNames();
    return names.filter((n) => n === `${APPOINTMENT_ROW_PREFIX}${doctorName}`).length;
  }

  // The booking reference (BK-YY-MMDD-NNNNNNN) shown on the detail route.
  async bookingReference(): Promise<string> {
    let texts = await this.visibleTexts();
    let match = texts.map((t) => t.match(BOOKING_REF_PATTERN)).find((m) => m !== null);
    if (!match) {
      throw new Error(
        'No booking reference (BK-YY-MMDD-NNNNNNN) found on the appointment detail screen.',
      );
    }
    return match[0];
  }

  // Cancel the open appointment.
  async cancelOpenAppointment() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.cancelAppointmentButton, 'Cancel Appointment button');
    await this.waitVisible(this.confirmCancellationButton, 'Confirm cancellation button');

    // NOTE the confusing pair on this sheet: "Confirm cancellation" cancels the
    // appointment, while "Cancel" merely dismisses the sheet. Do not swap them.
    await this.tap(this.confirmCancellationButton, 'Confirm cancellation');
    await this.waitGone(this.cancelSheetHeading, 'cancellation sheet');
  }

  // Open the cancellation sheet, assert its irreversibility warning, then go through with the cancellation.
  async cancelAppointmentAndExpectWarning() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.cancelAppointmentButton, 'Cancel Appointment button');
    await this.expectCancellationWarningIsShown();
    await this.tap(this.confirmCancellationButton, 'Confirm cancellation');
    await this.waitGone(this.cancelSheetHeading, 'cancellation sheet');
  }

  // ------------------------------------------------------------ list rows

  // How a list row stamps an appointment: "26 Sep 2026 · 7:00 AM". A row dated
  // today may instead read "Today, 25 Sep · 7:00 AM", so both are accepted.
  private rowStamps(date: string, time: string): string[] {
    let at = new Date(`${date}T${time}`);
    let day = at.getDate();
    let mon = at.toLocaleString('en-US', { month: 'short' });
    let clock = at
      .toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(/\u202f/g, ' '); // ICU puts a narrow no-break space before AM/PM
    let stamps = [`${day} ${mon} ${at.getFullYear()} · ${clock}`];
    if (date === localDate()) stamps.push(`Today, ${day} ${mon} · ${clock}`);
    return stamps;
  }

  private titleCase(status: string): string {
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  // The stamp the row actually shows: "Today, …" when dated today, else the full date.
  private displayedStamp(appt: { appointmentDate: string; timeSlot: string }): string {
    let stamps = this.rowStamps(appt.appointmentDate, appt.timeSlot);
    return stamps[stamps.length - 1];
  }

  // A row reads, in order: doctor | speciality | [visit-type chip] | status |
  // stamp | "Serial #n". The chip ("Teleconsultation") appears only on some rows,
  // so the row is cut around the STAMP and the chip is dropped — a fixed window
  // shifted by one on every teleconsultation row. `row` is the five texts left, so
  // a fact belonging to a neighbouring row cannot satisfy a check.
  private rowAround(texts: string[], stampAt: number): string[] {
    let chip = VISIT_TYPE_CHIPS.includes(texts[stampAt - 2]) ? 1 : 0;
    return [texts[stampAt - 3 - chip], texts[stampAt - 2 - chip], texts[stampAt - 1], texts[stampAt], texts[stampAt + 1]];
  }

  private rowFaults(
    row: string[],
    appt: { doctorName: string; appointmentDate: string; timeSlot: string; serialNumber: number },
    speciality: string,
    status: string,
  ): string[] {
    let expected: Array<[string, string]> = [
      ['doctor', appt.doctorName],
      ['speciality', speciality],
      ['status', status],
      ['date · time', this.displayedStamp(appt)],
      ['serial', `Serial #${appt.serialNumber}`],
    ];
    return expected
      .map(([label, value], i) => ({ label, value, got: row[i] }))
      .filter((f) => f.got !== f.value)
      .map((f) => `${f.label} "${f.got}" (expected "${f.value}")`);
  }

  async expectUpcomingRowShows(
    appt: { doctorName: string; appointmentDate: string; timeSlot: string; serialNumber: number },
    speciality: string,
  ) {
    let stamp = this.displayedStamp(appt);
    await this.scrollToText(stamp);
    let texts = await this.visibleTexts();
    let at = texts.indexOf(stamp);
    if (at < 0) throw new Error(`No Upcoming row stamped "${stamp}".`);
    let wrong = this.rowFaults(this.rowAround(texts, at), appt, speciality, APPOINTMENTS_TEXT.statusScheduled);
    if (wrong.length > 0) throw new Error(`The Upcoming row "${stamp}" is wrong: ${wrong.join('; ')}.`);
  }

  // Soonest first, judged on the stamps the rows SHOW — a row dated today must
  // read "Today, …", so a today row rendered with its full date fails here.
  async expectUpcomingSoonestFirst(
    appts: Array<{ appointmentDate: string; timeSlot: string }>,
  ) {
    let wanted = [...appts]
      .sort((a, b) => `${a.appointmentDate} ${a.timeSlot}`.localeCompare(`${b.appointmentDate} ${b.timeSlot}`))
      .map((a) => this.displayedStamp(a));
    let shown = (await this.visibleTexts()).filter((t) => wanted.includes(t));
    if (JSON.stringify(shown) !== JSON.stringify(wanted)) {
      throw new Error(`Upcoming is not soonest first: shown [${shown.join(', ')}], expected [${wanted.join(', ')}].`);
    }
  }

  // The detail stamps "Sat, 26 Sep 2026 · 7:00 AM" — the row stamp behind a weekday.
  async expectDetailShowsWhen(appt: { appointmentDate: string; timeSlot: string }) {
    await this.expectDetailIsOpen();
    await this.waitForText(this.rowStamps(appt.appointmentDate, appt.timeSlot)[0]);
  }

  async backToList() {
    await this.goBack();
    await this.waitVisible(this.heading, 'My Appointments heading');
  }

  async expectUpcomingIsEmpty() {
    await this.waitForText(APPOINTMENTS_TEXT.emptyUpcoming);
    let rows = (await this.a11yNames()).filter((n) => n.startsWith(APPOINTMENT_ROW_PREFIX));
    if (rows.length > 0) throw new Error(`Upcoming says it is empty but lists ${rows.length} row(s).`);
  }

  async startBookingFromList() {
    await this.tap(this.byA11y(APPOINTMENTS_A11Y.bookAppointment), 'Book Appointment (appointments list)');
  }

  // ------------------------------------------------------------ past rows

  // The Past list is virtualised and its rows share one a11y id, so a row is
  // reached by scrolling the list to its status text and tapping that text.
  async openFirstPastAppointmentWithStatus(status: 'Completed' | 'Cancelled') {
    await this.openPastRefreshed();
    await this.scrollToText(status);
    await this.tap(this.byText(status), `first ${status} row in Past`);
    await this.waitVisible(this.detailHeading, 'Appointment detail heading');
  }

  private async hasA11yStartingWith(prefix: string): Promise<boolean> {
    return (await this.a11yNames()).some((n) => n.startsWith(prefix));
  }

  // A finished appointment is not live: nothing on it can cancel, join or queue.
  private async expectNoLiveActions(state: string) {
    let live = [
      APPOINTMENT_DETAIL_A11Y.cancelAppointment,
      APPOINTMENT_DETAIL_A11Y.trackMyQueue,
      APPOINTMENT_DETAIL_A11Y.joinSession,
    ];
    let offered: string[] = [];
    for (let action of live) if (await this.hasA11yStartingWith(action)) offered.push(action);
    if (offered.length > 0) throw new Error(`A ${state} appointment still offers: ${offered.join(', ')}.`);
  }

  // Which quick actions a completed appointment offers depends on whether a
  // prescription was issued: without one it offers "Book follow-up", with one
  // "Download Prescriptions" and "Share with another doctor" (both observed
  // 2026-09-25). What holds for EVERY completed appointment is that it is final.
  async expectCompletedDetailIsFinal() {
    await this.expectDetailIsOpen();
    await this.waitForText(APPOINTMENTS_TEXT.statusCompleted);
    await this.waitForText(APPOINTMENT_DETAIL_TEXT.quickActions);
    await this.expectNoLiveActions('completed');
  }

  async expectCancelledDetailOffersNoActions() {
    await this.expectDetailIsOpen();
    await this.waitForText(APPOINTMENTS_TEXT.statusCancelled);
    await this.expectNoLiveActions('cancelled');
    if (await this.hasA11yStartingWith(APPOINTMENT_DETAIL_A11Y.bookFollowUpPrefix)) {
      throw new Error('A cancelled appointment offers "Book follow-up", but no consultation took place.');
    }
  }

  // Opens THIS appointment's detail from Past and returns the five texts of the
  // row that led there. Many rows are identical (doctor, stamp, "Serial #3",
  // Cancelled), so every row carrying the stamp is opened until one shows the
  // reference; its facts are read BEFORE the tap.
  //
  // The list is walked BY DATE (scrollPastTo). A just-seeded row is the newest
  // at its stamp, so it is normally the first one opened; Back keeps the
  // scroll position, so the rest of the block stays in place (2026-09-25).
  private async openPastRowByReference(appt: { bookingRef: string; appointmentDate: string; timeSlot: string }): Promise<string[]> {
    let stamp = this.displayedStamp(appt);
    let seen = '';
    for (let pull = 0; pull < 2; pull += 1) {
      await this.openPastRefreshed(); // a second pull when the first returned before the new row
      seen = await this.scrollPastTo(stamp);
      if (seen !== stamp) continue;
      await this.liftFirstRowStamped(stamp);
      let count = Array.from(await this.allByText(stamp)).length;
      for (let i = 0; i < count; i += 1) {
        let texts = await this.visibleTexts();
        let at = texts.map((t, index) => (t === stamp ? index : -1)).filter((index) => index >= 0)[i];
        let row = Array.from(await this.allByText(stamp))[i];
        if (!row || at === undefined) break;
        await row.click();
        await this.waitVisible(this.detailHeading, 'Appointment detail heading');
        if ((await this.decodedPageSource()).includes(appt.bookingRef)) return this.rowAround(texts, at);
        await this.backToList();
      }
      seen = `${count} row(s) stamped "${stamp}", none of them ${appt.bookingRef}`;
    }
    throw new Error(`${appt.bookingRef} ("${stamp}") is not in the Past tab after two pull-to-refreshes: ${seen}.`);
  }

  // A row stamp as a sortable time, or null when the text is not a stamp.
  private stampTime(text: string): number | null {
    let m = text.match(ROW_STAMP_PARTS);
    if (!m) return null;
    let month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[2]);
    let hour = (Number(m[4]) % 12) + (m[6] === 'PM' ? 12 : 0);
    let year = m[3] ? Number(m[3]) : new Date().getFullYear();
    return new Date(year, month, Number(m[1]), hour, Number(m[5])).getTime();
  }

  // Past is sorted by date · time, LATEST first; identical rows list newest-
  // created first (device walk 2026-09-25). So the walk is directed: step down
  // until the stamp shows, and stop the moment the list has passed its time.
  // Returns the stamp when reached, otherwise where the walk stopped and why.
  private async scrollPastTo(stamp: string): Promise<string> {
    let target = this.stampTime(stamp) ?? 0;
    let before = '';
    for (let step = 0; step < 60; step += 1) {
      let stamps = (await this.visibleTexts()).filter((t) => this.stampTime(t) !== null);
      if (stamps.includes(stamp)) return stamp;
      let oldest = stamps[stamps.length - 1];
      if (oldest && (this.stampTime(oldest) ?? 0) < target) return `the list passed its time and reached "${oldest}"`;
      if (stamps.join('|') === before) return `the list ended at "${oldest}"`;
      before = stamps.join('|');
      await this.scrollDown();
    }
    return 'the walk gave up after 60 steps';
  }

  // Coming from above, the first row with the stamp surfaces at the bottom,
  // under the floating nav. Lift it by a third of the list — never so far
  // that a row higher on screen scrolls away.
  private async liftFirstRowStamped(stamp: string) {
    let first = Array.from(await this.allByText(stamp))[0];
    if (!first) return;
    let { height } = await d().getWindowSize();
    if ((await first.getLocation()).y > height * 0.6) await this.scrollListBy(0.3);
  }

  async openPastAppointmentByReference(appt: { bookingRef: string; appointmentDate: string; timeSlot: string }) {
    await this.openPastRowByReference(appt);
  }

  // Finds the appointment in Past BY REFERENCE, checks the row that led to it
  // shows doctor, speciality, status, date · time and serial, and leaves its
  // detail open showing the same status.
  async expectPastRowShows(
    appt: { bookingRef: string; doctorName: string; appointmentDate: string; timeSlot: string; serialNumber: number },
    speciality: string,
    status: 'CANCELLED' | 'COMPLETED',
  ) {
    let row = await this.openPastRowByReference(appt);
    let wrong = this.rowFaults(row, appt, speciality, this.titleCase(status));
    if (wrong.length > 0) throw new Error(`The Past row for ${appt.bookingRef} is wrong: ${wrong.join('; ')}.`);
    await this.waitForText(this.titleCase(status));
  }

  // A completed appointment's "Book follow-up" quick action. It opens the
  // DOCTOR PROFILE (not the date sheet), pre-filled with the doctor and the
  // chamber of the completed appointment — device-verified 2026-09-25.
  async startFollowUpBooking() {
    await this.scrollToA11yPrefix(APPOINTMENT_DETAIL_A11Y.bookFollowUpPrefix);
    await this.tap(this.byA11yPrefix(APPOINTMENT_DETAIL_A11Y.bookFollowUpPrefix), 'Book follow-up');
    await this.waitForText(DOCTOR_PROFILE_TEXT.heading);
  }

  // --------------------------------------------------------- cancel sheet

  // "Cancel" on this sheet means KEEP the appointment; "Confirm cancellation"
  // is the destructive one. Proves the safe exit leaves it untouched.
  async openCancelSheetAndKeepAppointment() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.cancelAppointmentButton, 'Cancel Appointment button');
    await this.expectCancellationWarningIsShown();
    await this.tap(this.byA11y(CANCEL_SHEET_A11Y.dismissWithoutCancelling), 'Cancel (keep the appointment)');
    await this.waitGone(this.cancelSheetHeading, 'cancellation sheet');
    await this.expectDetailStatusIsScheduled();
    await this.waitVisible(this.cancelAppointmentButton, 'Cancel Appointment button, still offered');
  }

  // -------------------------------------------------------------- guarantees

  async expectListIsOpen() {
    await this.waitVisible(this.heading, 'My Appointments heading');
  }

  async expectAppointmentIsListed(doctorName: string) {
    await this.scrollFieldIntoReach(doctorName);
    await this.waitVisible(this.appointmentRow(doctorName), `appointment for "${doctorName}"`);
  }

  async expectAppointmentIsNotListed(doctorName: string) {
    await this.waitGone(this.appointmentRow(doctorName), `appointment for "${doctorName}"`);
  }

  async expectDetailIsOpen() {
    await this.waitVisible(this.detailHeading, 'Appointment detail heading');
    await this.waitForText(APPOINTMENT_DETAIL_TEXT.appointmentNo);
    await this.waitForText(APPOINTMENT_DETAIL_TEXT.dateAndTime);
  }

  async expectDetailShows(doctorName: string) {
    await this.expectDetailIsOpen();
    await this.waitForText(doctorName);
  }

  async expectStatusIsScheduled() {
    await this.waitForText(APPOINTMENTS_TEXT.statusScheduled);
  }

  // Reads the device clipboard rather than trusting the tap: a Copy button that
  // copies nothing looks identical on screen. The copied value is the SHORTENED
  // link the screen displays, not the long /teleconsult/join URL it redirects
  // to, so it is compared against what the detail actually shows.
  async copyTeleconsultationLink() {
    await this.scrollFieldIntoReach(TELECONSULTATION_DETAIL_TEXT.linkLabel);
    let shown = (await this.visibleTexts()).find((t) =>
      TELECONSULTATION_JOIN_WEB.linkPattern.test(t),
    );
    if (!shown) {
      throw new Error('The appointment detail shows no teleconsultation link to copy.');
    }

    await this.tap(this.byA11y(TELECONSULTATION_DETAIL_TEXT.copyLink), 'Copy Link');

    let clipboard = Buffer.from(await d().getClipboard(), 'base64').toString('utf8');
    if (clipboard.trim() !== shown.trim()) {
      throw new Error(
        `Copy Link put "${clipboard}" on the clipboard, but the screen shows "${shown}".`,
      );
    }
    await waitForClipboardOverlayToClose();
  }

  // Today's link is active, so joining reaches the waiting room. Leaves the app
  // for the browser, so it returns.
  async expectJoinReachesTheWaitingRoom() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.byA11y(TELECONSULTATION_DETAIL_TEXT.joinSession), 'Join Session');
    await this.waitForText(TELECONSULTATION_JOIN_WEB.waitingForDoctor);
    await this.closeAndReturnToApp(TELECONSULTATION_JOIN_WEB.browserPackage);
  }

  // Join Session leaves the app for the browser, so this CLOSES the browser and
  // returns — a test stranded in Chrome would strand every test after it, and a
  // tab left open flashes up whenever the app is closed.
  async expectJoinIsRefusedBeforeTheSession() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.byA11y(TELECONSULTATION_DETAIL_TEXT.joinSession), 'Join Session');
    await this.waitForText(TELECONSULTATION_JOIN_WEB.notActiveHeading);
    await this.waitForText(TELECONSULTATION_JOIN_WEB.notActiveDetail);
    await this.closeAndReturnToApp(TELECONSULTATION_JOIN_WEB.browserPackage);
  }

  async openTrackMyQueue() {
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.tap(this.trackMyQueueButton, 'Track My Queue');
    await this.waitForText(QUEUE_TEXT.heading);
  }

  // Asserts the queue TOKEN (T-nnn), not serialNumber — different identifiers:
  // serialNumber 1 rendered as "T-007".
  async expectQueueTrackerShowsPosition() {
    await this.waitForText(QUEUE_TEXT.heading);
    await this.waitForText(QUEUE_TEXT.yourSerial);
    await this.waitForText(QUEUE_TEXT.nowServing);
    await this.waitForText(QUEUE_TEXT.peopleAhead);

    let texts = await this.visibleTexts();
    if (!texts.some((t) => QUEUE_TOKEN_PATTERN.test(t))) {
      throw new Error('The live queue screen shows no queue token (T-nnn).');
    }
  }

  async leaveTrackMyQueue() {
    await this.goBack();
    await this.waitVisible(this.detailHeading, 'Appointment detail heading');
  }

  // bookingRef is read off the screen here rather than passed in: the spec would
  // otherwise read it from this same detail and hand it straight back.
  async expectDetailMatches(expected: {
    doctor: { fullName: string; primarySpeciality: string };
    chamber: { name: string };
    typeLabel: string;
  }) {
    await this.expectDetailIsOpen();
    let bookingRef = await this.bookingReference();
    let source = await this.decodedPageSource();
    // Collected so a wrong chamber does not hide a wrong serial.
    let missing = (
      [
        ['doctor name', expected.doctor.fullName],
        ['speciality', expected.doctor.primarySpeciality],
        ['chamber', expected.chamber.name],
        ['booking reference', bookingRef],
        ['appointment type chip', expected.typeLabel],
        ['status chip', APPOINTMENTS_TEXT.statusScheduled],
      ] as const
    ).filter(([, value]) => !source.includes(value));

    if (missing.length > 0) {
      throw new Error(
        `Appointment detail is missing: ${missing
          .map(([label, value]) => `${label} ("${value}")`)
          .join('; ')}.`,
      );
    }
  }

  async expectBothTabsAreOffered() {
    await this.waitVisible(this.upcomingTab, 'Upcoming tab');
    await this.waitVisible(this.pastTab, 'Past tab');
  }

  // The booking reference the backend issued for THIS appointment.
  async expectBookingReferenceIs(bookingRef: string) {
    await this.waitForText(bookingRef);
  }

  // This specific booking is absent from the list on screen.
  async expectBookingReferenceIsNotListed(bookingRef: string) {
    await d().waitUntil(
      async () => !(await this.visibleTexts()).some((t) => t.includes(bookingRef)),
      {
        timeout: TIMEOUTS.content,
        interval: TIMEOUTS.interval,
        timeoutMsg: `Booking "${bookingRef}" was still listed when it should not be.`,
      },
    );
  }

  async expectDetailShowsType(typeLabel: string) {
    await this.expectDetailIsOpen();
    // The chip is its own element, so match it EXACTLY: a page-source substring
    // would let "Follow-up" be satisfied by any longer text that contains it.
    await d().waitUntil(async () => (await this.visibleTexts()).includes(typeLabel), {
      timeout: TIMEOUTS.content,
      interval: TIMEOUTS.interval,
      timeoutMsg: `The appointment detail shows no "${typeLabel}" chip.`,
    });
  }

  async expectTeleconsultationJoinIsOffered() {
    await this.expectDetailIsOpen();
    await this.waitForText(TELECONSULTATION_DETAIL_TEXT.linkLabel);
    await this.waitForText(TELECONSULTATION_DETAIL_TEXT.joinSession);
  }

  // Read once, after the detail has settled — an absence assertion must not be a wait, or it passes simply by looking before the screen rendered.
  async expectTeleconsultationJoinIsNotOffered() {
    await this.expectDetailIsOpen();
    await this.waitForText(APPOINTMENT_DETAIL_TEXT.clinic); // detail body is rendered
    let source = await this.decodedPageSource();
    if (source.includes(TELECONSULTATION_DETAIL_TEXT.joinSession)) {
      throw new Error(
        `"${TELECONSULTATION_DETAIL_TEXT.joinSession}" is offered on an in-person appointment.`,
      );
    }
  }

  // A booking note is saved as the appointment's `reason` and shown under this label.
  async expectReasonForVisitIs(note: string) {
    await this.expectDetailIsOpen();
    await this.scrollToText(APPOINTMENT_DETAIL_TEXT.reasonForVisit);
    await this.waitForText(APPOINTMENT_DETAIL_TEXT.reasonForVisit);
    await this.waitForText(note);
  }

  async expectDetailShowsChamber(chamberName: string) {
    await this.expectDetailIsOpen();
    await this.scrollFieldIntoReach(APPOINTMENT_DETAIL_TEXT.clinic);
    await this.waitForText(chamberName);
  }

  // The Past tab holds at least one completed appointment.
  async expectPastListIsPopulated() {
    await d().waitUntil(
      async () => {
        let names = await this.a11yNames();
        return names.some((n) => n.startsWith(APPOINTMENT_ROW_PREFIX));
      },
      {
        timeout: TIMEOUTS.content,
        interval: TIMEOUTS.interval,
        timeoutMsg:
          'The Past tab rendered no appointment rows, although the account holds ' +
          'past appointments according to the API.',
      },
    );
  }

  // No appointment with this doctor was created in the last moments.
  async expectNoAppointmentBookedJustNowFor(doctorName: string) {
    let count = await this.countRowsFor(doctorName);
    if (count > 0) {
      throw new Error(
        `Expected no appointment for "${doctorName}" after backing out of the ` +
          `confirmation screen, but found ${count}.`,
      );
    }
  }

  // The cancellation sheet warns the action is irreversible.
  async expectCancellationWarningIsShown() {
    await this.waitVisible(this.cancelSheetHeading, 'cancellation sheet heading');
    await this.waitForText(CANCEL_SHEET_TEXT.warning);
  }

  async expectDetailStatusIsScheduled() {
    await this.expectDetailIsOpen();
    await this.waitForText(APPOINTMENTS_TEXT.statusScheduled);
  }

  // Takes the rows rather than fetching them: a page object makes no API calls.
  // Fetches its own rows, so a spec holds no intermediate list.
  // Statuses from the API, order from the SCREEN. The API returns same-day rows
  // in ascending time and the app re-sorts them for display, so judging the API's
  // order failed a correct screen. Verified 2026-09-24: 25 Sep showed 5:00 PM
  // above 2:00 PM while the API listed 07:00 before 14:00.
  async expectPastIsFinishedAndNewestFirst(
    rows: Array<{ bookingRef: string; status: string; at: string }>,
  ) {
    this.expectPastHoldsOnlyFinishedAppointments(rows);
    await this.expectVisiblePastRowsAreNewestFirst();
  }

  expectPastHoldsOnlyFinishedAppointments(
    rows: Array<{ bookingRef: string; status: string; at: string }>,
  ) {
    let live = rows.filter((r) => !HISTORY_STATUSES.includes(r.status));
    if (live.length > 0) {
      throw new Error(
        `Appointment history holds ${live.length} appointment(s) that are not ` +
          `COMPLETED, CANCELLED or NO_SHOW: ` +
          live.map((r) => `${r.bookingRef} (${r.status})`).join(', '),
      );
    }
  }

  // The list is virtualised, so this judges the rows actually rendered — the
  // honest scope of a screen assertion. Equal timestamps are not a violation.
  async expectVisiblePastRowsAreNewestFirst() {
    let stamps = (await this.visibleTexts())
      .filter((t) => PAST_ROW_STAMP.test(t))
      .map((t) => ({ text: t, at: Date.parse(t.replace(' · ', ' ')) }));
    if (stamps.length < 2) {
      throw new Error(`Only ${stamps.length} Past row(s) rendered — too few to judge order.`);
    }
    let late = stamps.filter((s, i) => i > 0 && s.at > stamps[i - 1].at);
    if (late.length > 0) {
      throw new Error(
        `The Past tab is not newest-first: ` +
          late.map((s) => `"${s.text}" listed below an earlier row`).join('; '),
      );
    }
  }

  // Equal timestamps are not a violation; only a strictly later row fails.
  expectPastIsSortedNewestFirst(rows: Array<{ bookingRef: string; at: string }>) {
    let outOfOrder = rows
      .map((row, index) => ({ row, previous: rows[index - 1] }))
      .filter(({ row, previous }) => previous !== undefined && row.at > previous.at);

    if (outOfOrder.length > 0) {
      throw new Error(
        `The Past list is not newest-first: ` +
          outOfOrder
            .map(({ row, previous }) => `${row.bookingRef} (${row.at}) after ${previous!.at}`)
            .join('; '),
      );
    }
  }
}
