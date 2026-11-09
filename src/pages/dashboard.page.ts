import { BasePage } from './base.page';
import { d } from '../support/driver';
import { TIMEOUTS } from '../support/config';
import { NAV_A11Y } from '../locators/nav.locators';
import { DASHBOARD_A11Y, DASHBOARD_A11Y_PREFIX, DASHBOARD_TEXT, DASHBOARD_TILE_SUFFIX } from '../locators/dashboard.locators';
import { PROFILE_TEXT } from '../locators/profile.locators';
import type { CustomerProfile } from '../api/client';
import type { ProfileEdits } from '../data/profile.data';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type HealthFacts = { bloodGroup: string; dateOfBirth: Date; allergies: string[]; conditions: string[] };

// The dashboard (Home tab).
export class DashboardPage extends BasePage {
  // --------------------------------------------------------------- locators

  private get glanceSubheading() {
    return this.byText(DASHBOARD_TEXT.glanceSubheading);
  }

  private get bookAppointment() {
    return this.byA11y(DASHBOARD_A11Y.bookAppointment);
  }

  // ---------------------------------------------------------------- actions

  // Home, then a pull-to-refresh. The dashboard does not refresh on its own
  // after a profile save (device-verified 2026-09-25); by instruction the suite
  // reloads rather than treating that as a defect.
  async openHomeReloaded() {
    await this.tap(this.byA11y(NAV_A11Y.home), 'Home tab');
    await this.waitVisible(this.glanceSubheading, 'health-at-a-glance subheading');
    await this.pullToRefresh();
  }

  async openAppointmentTile() {
    await this.tap(this.byA11yPrefix(DASHBOARD_A11Y_PREFIX.appointmentCard), 'Appointment tile');
  }

  async openPrescriptionTile() {
    await this.tap(this.byA11yPrefix(DASHBOARD_A11Y_PREFIX.prescriptionCard), 'Prescription tile');
  }

  // --------------------------------------------------------------- reading

  // A tile reads: label | value | detail — e.g. "Age" | "30 yrs" | "DOB · 16 Nov 1995".
  private async tile(label: string): Promise<[string | undefined, string | undefined]> {
    let texts = await this.visibleTexts();
    let at = texts.indexOf(label);
    return at < 0 ? [undefined, undefined] : [texts[at + 1], texts[at + 2]];
  }

  private ageOn(birth: Date, today = new Date()): number {
    let age = today.getFullYear() - birth.getFullYear();
    let beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    return beforeBirthday ? age - 1 : age;
  }

  // 0 -> "None known"; 1-2 joined " · "; 3+ -> two of them and "+N"
  // ("Aspirin · Dust mites +1", observed 2026-09-25). The ORDER is not a product
  // rule — after an Others save the app lists presets before custom entries —
  // so a tile is judged on WHICH entries it names and how many, not their order.
  private listFaults(label: string, shown: string | undefined, names: readonly string[]): string[] {
    if (names.length === 0) return shown === PROFILE_TEXT.noneKnown ? [] : [`${label} "${shown}" (expected "${PROFILE_TEXT.noneKnown}")`];
    let match = (shown ?? '').match(/^(.*?)(?: \+(\d+))?$/);
    let listed = (match?.[1] ?? '').split(' · ');
    let more = Number(match?.[2] ?? 0);
    let wantListed = Math.min(names.length, 2);
    let faults: string[] = [];
    if (listed.length !== wantListed || more !== names.length - wantListed) faults.push(`${label} "${shown}" does not show ${names.length} entries`);
    let strangers = listed.filter((n) => !names.includes(n));
    if (strangers.length > 0) faults.push(`${label} names ${strangers.map((n) => `"${n}"`).join(', ')}, not among ${names.join(', ')}`);
    if (new Set(listed).size !== listed.length) faults.push(`${label} "${shown}" repeats an entry`);
    return faults;
  }

  // After a pull the dashboard first repaints its CACHED values and only then
  // the fresh ones (a second pull showed the change the first did not). So a
  // check is retried — re-pulling every few seconds — until it passes or the
  // content timeout runs out, and then reports what was still wrong.
  private async untilNoFaults(read: () => Promise<string[]>, heading: string) {
    let faults: string[] = [];
    let started = Date.now();
    while (Date.now() - started < TIMEOUTS.content) {
      faults = await read();
      if (faults.length === 0) return;
      await this.pullToRefresh();
    }
    throw new Error(`${heading}:\n  - ${faults.join('\n  - ')}`);
  }

  private async healthFaults(facts: HealthFacts): Promise<string[]> {
    let faults: string[] = [];
    let compare = (what: string, got: string | undefined, want: string) => { if (got !== want) faults.push(`${what} "${got}" (expected "${want}")`); };
    let dob = facts.dateOfBirth;

    compare('Blood Group', (await this.tile(DASHBOARD_TEXT.bloodGroup))[0], facts.bloodGroup);
    let [age, dobLine] = await this.tile(DASHBOARD_TEXT.age);
    compare('Age', age, `${this.ageOn(dob)} ${DASHBOARD_TEXT.ageSuffix}`);
    compare('DOB', dobLine, `${DASHBOARD_TEXT.dobPrefix} ${dob.getDate()} ${SHORT_MONTHS[dob.getMonth()]} ${dob.getFullYear()}`);
    for (let [label, names] of [[DASHBOARD_TEXT.knownAllergies, facts.allergies], [DASHBOARD_TEXT.chronicCondition, facts.conditions]] as const) {
      let [count, detail] = await this.tile(label);
      compare(`${label} count`, count, String(names.length));
      faults.push(...this.listFaults(label, detail, names));
    }
    return faults;
  }

  // -------------------------------------------------------------- guarantees

  async expectDashboardIsOpen() {
    await this.waitVisible(this.glanceSubheading, 'health-at-a-glance subheading');
  }

  // Asserts the NAME, not the greeting word — "Good evening" changes with the time of day.
  async expectGreetingNames(displayName: string) {
    await this.waitForText(displayName);
  }

  // The health tiles show what the account holds.
  async expectHealthTilesShowAccount(account: CustomerProfile) {
    let facts = { bloodGroup: account.bloodGroup, dateOfBirth: new Date(`${account.dateOfBirth}T00:00:00`), allergies: account.knownAllergies, conditions: account.chronicConditions };
    await this.untilNoFaults(() => this.healthFaults(facts), 'The dashboard health tiles do not match the account');
  }

  // The health tiles show a saved profile edit — added on top of what the account had.
  async expectHealthTilesShowEdits(edits: ProfileEdits, account: CustomerProfile) {
    let facts = { bloodGroup: edits.bloodGroup, dateOfBirth: edits.dateOfBirth, allergies: account.knownAllergies, conditions: account.chronicConditions };
    await this.untilNoFaults(async () => [
      ...((await this.visibleTexts()).some((t) => t.includes(edits.firstName)) ? [] : [`greeting does not name "${edits.firstName}"`]),
      ...(await this.healthFaults(facts)),
    ], 'The dashboard does not reflect the profile edit');
  }

  // Only the Known Allergies and Chronic Condition tiles: count and names.
  async expectAllergyAndConditionTiles(expected: { allergies: string[]; conditions: string[] }) {
    await this.untilNoFaults(async () => {
      let faults: string[] = [];
      for (let [label, names] of [[DASHBOARD_TEXT.knownAllergies, expected.allergies], [DASHBOARD_TEXT.chronicCondition, expected.conditions]] as const) {
        let [count, detail] = await this.tile(label);
        if (count !== String(names.length)) faults.push(`${label} count "${count}" (expected "${names.length}")`);
        faults.push(...this.listFaults(label, detail, names));
      }
      return faults;
    }, 'The allergy / condition tiles are wrong');
  }

  async expectAppointmentTileCounts(upcoming: number) {
    await this.waitVisible(this.byA11y(`${DASHBOARD_A11Y_PREFIX.appointmentCard} ${upcoming} ${DASHBOARD_TILE_SUFFIX.appointment}`), `Appointment tile "${upcoming} upcoming"`);
  }

  async expectPrescriptionTileCounts(saved: number) {
    await this.waitVisible(this.byA11y(`${DASHBOARD_A11Y_PREFIX.prescriptionCard} ${saved} ${DASHBOARD_TILE_SUFFIX.prescription}`), `Prescription tile "${saved} saved"`);
  }

  // The Prescription tile lands on My Prescriptions, counting the same number.
  async expectPrescriptionListOpenedWith(saved: number) {
    await this.waitForText(DASHBOARD_TEXT.prescriptionsHeading);
    await this.waitForText(`${saved} prescriptions`);
  }

  async expectBookAppointmentIsOffered() {
    await this.waitVisible(this.bookAppointment, 'Book Appointment button');
  }
}
