import * as path from 'path';
import { BasePage } from './base.page';
import { d, pushToGallery } from '../support/driver';
import { TIMEOUTS } from '../support/config';
import { NAV_A11Y } from '../locators/nav.locators';
import { CONDITIONS, DOB_FIELD_PATTERN, EDIT_HINT, EDIT_LABEL, GENDER_A11Y, PHOTO_PICKER, PROFILE_A11Y, PROFILE_TEXT, VALIDATION_TEXT, VIEW_LABEL } from '../locators/profile.locators';
import type { CustomerProfile } from '../api/client';
import type { Condition, ProfileEdits } from '../data/profile.data';
import type { SizedPhoto } from '../data/photos';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// My Profile (read view) and Edit Profile (the form, its password block and the photo flow).
export class ProfilePage extends BasePage {
  // --------------------------------------------------------------- locators

  private get heading() {
    return this.byText(PROFILE_TEXT.heading);
  }

  private get saveChanges() {
    return this.byA11y(PROFILE_A11Y.saveChanges);
  }

  private get keypadDone() {
    return this.byA11y(PROFILE_A11Y.keypadDone);
  }

  // Order under the "Height (cm)" label is height, then weight: the two labels
  // sit on one row ABOVE both inputs, so weight is the 2nd field below height.
  private get heightField() {
    return this.fieldBelow(EDIT_LABEL.height, 1);
  }

  private get weightField() {
    return this.fieldBelow(EDIT_LABEL.height, 2);
  }

  // A field still showing its placeholder — matched on the exact text; placeholders exist only on the form.
  private hintField(hint: string) {
    return this.fieldWithText(hint);
  }

  // ------------------------------------------------------------ formatting

  // "16 November 1999" — how My Profile shows a date of birth.
  private longDate(iso: string | Date): string {
    let at = typeof iso === 'string' ? new Date(`${iso}T00:00:00`) : iso;
    return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
  }

  // "16111999" — what is typed into the DOB field's number pad.
  private dobDigits(at: Date): string {
    let pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(at.getDate())}${pad(at.getMonth() + 1)}${at.getFullYear()}`;
  }

  // "+880 1712-345678" — how the app shows a local 01XXXXXXXXX number.
  private phoneShown(local: string): string {
    return `+880 ${local.slice(1, 5)}-${local.slice(5)}`;
  }

  private bmi(heightCm: number, weightKg: number): string {
    return (Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10).toFixed(1);
  }

  // ------------------------------------------------------------ navigation

  async openProfile() {
    await this.tap(this.byA11y(NAV_A11Y.profile), 'Profile tab');
    await this.waitVisible(this.heading, 'My Profile heading');
  }

  // The form opens from the app's CACHED profile; a change made outside the app
  // does not reach it (findings/profile.txt). The fixture restarts the app after
  // every API restore — a pull-to-refresh did not reliably re-sync it.
  async openEditProfile() {
    await this.openProfile();
    await this.scrollToText(PROFILE_A11Y.editProfile);
    await this.tap(this.byA11y(PROFILE_A11Y.editProfile), 'Edit Profile');
    await this.waitVisible(this.saveChanges, 'Save Changes');
  }

  private async save() {
    await this.tap(this.saveChanges, 'Save Changes');
  }

  // Leave the form without saving. Lands back on My Profile.
  private async cancelEdit() {
    await this.scrollToTop();
    await this.tap(this.byA11y(PROFILE_A11Y.cancel), 'Cancel (edit)');
    await this.waitVisible(this.heading, 'My Profile heading');
  }

  // Every text on a long screen, top to bottom, each once.
  private async allTexts(): Promise<string[]> {
    await this.scrollToTop();
    let seen: string[] = [];
    let before = '';
    for (let step = 0; step < 10; step += 1) {
      let texts = await this.visibleTexts();
      for (let text of texts) if (!seen.includes(text)) seen.push(text);
      if (texts.join('|') === before) break;
      before = texts.join('|');
      await this.scrollDown();
    }
    return seen;
  }

  // The value shown under a label, skipping the "Optional" tag some carry.
  private valueAfter(texts: string[], label: string): string | undefined {
    let at = texts.indexOf(label);
    if (at < 0) return undefined;
    return texts.slice(at + 1).find((t) => t !== 'Optional');
  }

  private async selectedGender(): Promise<string | undefined> {
    await this.scrollTextHigh(EDIT_LABEL.gender); // the radios must be on screen to be read
    for (let label of Object.values(GENDER_A11Y)) {
      for (let radio of await this.allByA11yPrefix(label)) if ((await radio.getAttribute('selected')) === 'true') return label;
    }
    return undefined;
  }

  // ---------------------------------------------------------------- editing

  private async chooseBloodGroup(bloodGroup: string) {
    await this.scrollTextHigh(EDIT_LABEL.address); // the picker sits just above Address
    await this.tap(this.byA11y(PROFILE_A11Y.bloodGroup), 'Blood Group');
    await this.tap(this.byA11y(bloodGroup), `blood group ${bloodGroup}`);
    await this.waitVisible(this.saveChanges, 'Save Changes after the blood-group sheet');
  }

  private async setHeightAndWeight(heightCm: string, weightKg: string) {
    await this.scrollTextHigh(EDIT_LABEL.height);
    await this.replaceIn(this.heightField, heightCm, 'Height (cm)');
    await this.closeKeypad(this.keypadDone);
    await this.replaceIn(this.weightField, weightKg, 'Weight (kg)');
    await this.closeKeypad(this.keypadDone);
  }

  // The phone field is masked: tap, clear, then type into the focused field.
  private async setEmergencyPhone(local: string) {
    await this.scrollTextHigh(EDIT_LABEL.emergencyPhone);
    await this.tap(this.fieldBelow(EDIT_LABEL.emergencyPhone), 'Emergency Contact Phone');
    await this.focusedField().clearValue();
    await this.focusedField().addValue(local.replace(/^0/, '')); // the +880 prefix is fixed
    await this.closeKeypad(this.keypadDone);
  }

  private async setDateOfBirth(at: Date) {
    await this.scrollToTop();
    await this.typeInto(this.fieldMatching(DOB_FIELD_PATTERN), this.dobDigits(at), 'Date of birth');
    await this.closeKeypad(this.keypadDone);
  }

  // Every personal and health-metric field except email and password, then
  // Save. Allergies and conditions have their own case.
  async editEveryField(edits: ProfileEdits) {
    await this.openEditProfile();
    // Plain text fields take setValue directly; tapping first is unreliable
    // (the tap can land on the footer or lose focus to the keyboard).
    await this.fieldBelow(EDIT_LABEL.firstName).setValue(edits.firstName);
    await this.fieldBelow(EDIT_LABEL.lastName).setValue(edits.lastName);
    await this.hideKeyboard();
    await this.setDateOfBirth(edits.dateOfBirth);
    await this.chooseBloodGroup(edits.bloodGroup);
    await this.fieldBelow(EDIT_LABEL.address).setValue(edits.address);
    await this.hideKeyboard();
    await this.scrollTextHigh(EDIT_LABEL.gender);
    await this.tap(this.byA11y(GENDER_A11Y[edits.gender]), `gender ${edits.gender}`);
    await this.setHeightAndWeight(String(edits.heightCm), String(edits.weightKg));
    await this.scrollTextHigh(EDIT_LABEL.emergencyName);
    await this.fieldBelow(EDIT_LABEL.emergencyName).setValue(edits.emergencyName); // a tap here lands on the sticky footer
    await this.hideKeyboard();
    await this.setEmergencyPhone(edits.emergencyPhone);

    await this.save();
    await this.waitForText(PROFILE_TEXT.savedToast);
  }

  // ---------------------------------------------------- allergies & conditions

  private async openAllergiesTab() {
    await this.scrollToTop();
    await this.tap(this.byA11yPrefix(PROFILE_A11Y.allergiesTab), 'Allergies & Conditions tab');
    await this.waitForText(EDIT_HINT.allergen);
  }

  private async addAllergy(name: string) {
    await this.scrollToText(EDIT_HINT.allergen);
    await this.hintField(EDIT_HINT.allergen).setValue(name);
    await this.tap(this.byA11y(PROFILE_A11Y.addAllergy), '+ Add allergy');
    await this.hideKeyboard();
  }

  private async tickCondition(condition: Condition) {
    await this.scrollToText(condition.name);
    await this.tap(this.byA11y(condition.a11y), `condition ${condition.name}`);
  }

  // Every entry — allergy or condition — is a chip whose a11y id is "Remove <name>".
  private async removeChip(name: string) {
    await this.scrollToA11yPrefix(`${PROFILE_A11Y.removeChipPrefix}${name}`); // condition chips sit lower, under Chronic Conditions
    await this.tap(this.byA11y(`${PROFILE_A11Y.removeChipPrefix}${name}`), `remove ${name}`);
  }

  private async saveHealthEdit() {
    await this.save();
    await this.waitForText(PROFILE_TEXT.savedToast);
  }

  async addAllergiesAndConditions(allergies: string[], conditions: Condition[]) {
    await this.openEditProfile();
    await this.openAllergiesTab();
    for (let allergy of allergies) await this.addAllergy(allergy);
    for (let condition of conditions) await this.tickCondition(condition);
    await this.saveHealthEdit();
  }

  async removeAllergyAndCondition(allergy: string, condition: Condition) {
    await this.openEditProfile();
    await this.openAllergiesTab();
    await this.removeChip(allergy);
    await this.removeChip(condition.name);
    await this.saveHealthEdit();
  }

  // Others -> its box -> the device keyboard's Enter, then Save. The box holds
  // every custom condition comma-separated, so a new one is appended after
  // ", " when it already holds some; Others is ticked only if it is not already.
  async addCustomCondition(name: string) {
    await this.openEditProfile();
    await this.openAllergiesTab();
    await this.scrollToText(PROFILE_A11Y.othersCondition.split(',')[0]);
    let others = this.byA11y(PROFILE_A11Y.othersCondition);
    if ((await others.getAttribute('checked')) !== 'true') await this.tap(others, 'Others');
    await this.scrollTextHigh(EDIT_HINT.customConditionSubmit);
    let box = this.fieldAbove(EDIT_HINT.customConditionSubmit);
    let held = await box.getText();
    let prefix = held && held !== EDIT_HINT.customCondition ? ', ' : '';
    await this.typeAndSubmit(box, `${prefix}${name}`, 'Others box');
    await this.hideKeyboard();
    await this.saveHealthEdit();
  }

  // Reopened, the form still carries the custom condition — as a chip, or in the Others box.
  async expectCustomConditionKept(name: string) {
    await this.openEditProfile();
    await this.openAllergiesTab();
    let chip = await this.isVisible(this.byA11y(`${PROFILE_A11Y.removeChipPrefix}${name}`));
    let texts = await this.allTexts();
    await this.cancelEdit();
    if (!chip && !texts.includes(name)) {
      throw new Error(`The custom condition "${name}" entered under Others is gone when the form is reopened.`);
    }
  }

  // One pull on My Profile — used ONLY after an API fallback restore, the one
  // case where the app's cached profile is behind the server.
  async reloadMyProfile() {
    await this.openProfile();
    await this.scrollToTop();
    await this.pullToRefresh();
  }

  // TEARDOWN — put back, THROUGH THE UI, only the fields that differ from the
  // account the run found, so the app's own copy stays current (an API restore
  // is invisible to the app until a reload). No-op when nothing changed.
  // Throws on anything it cannot do in the UI; the fixture then falls back to the API.
  async restoreThroughUi(now: CustomerProfile, original: CustomerProfile) {
    let text = (f: 'firstName' | 'lastName' | 'address' | 'emergencyContactName') => (now[f] ?? '') !== (original[f] ?? '');
    let extraAllergies = now.knownAllergies.filter((a) => !original.knownAllergies.includes(a));
    let missingAllergies = original.knownAllergies.filter((a) => !now.knownAllergies.includes(a));
    let extraConditions = now.chronicConditions.filter((c) => !original.chronicConditions.includes(c));
    let missingConditions = original.chronicConditions.filter((c) => !now.chronicConditions.includes(c));
    let personal = text('firstName') || text('lastName') || text('address') || text('emergencyContactName')
      || now.dateOfBirth !== original.dateOfBirth || now.bloodGroup !== original.bloodGroup || now.gender !== original.gender
      || now.heightCm !== original.heightCm || now.weightKg !== original.weightKg;
    let lists = extraAllergies.length + missingAllergies.length + extraConditions.length + missingConditions.length > 0;
    if (!personal && !lists) return;

    let unlisted = missingConditions.filter((c) => !CONDITIONS.some((p) => p.name === c));
    if (unlisted.length > 0) throw new Error(`cannot re-add custom condition(s) ${unlisted.join(', ')} through the UI`);

    await this.openEditProfile();
    let setText = async (label: string, value: string) => {
      let field = this.fieldBelow(label);
      await field.clearValue();
      if (value) await field.setValue(value);
    };
    if (text('firstName')) await setText(EDIT_LABEL.firstName, original.firstName);
    if (text('lastName')) await setText(EDIT_LABEL.lastName, original.lastName);
    await this.hideKeyboard();
    if (now.dateOfBirth !== original.dateOfBirth) await this.setDateOfBirth(new Date(`${original.dateOfBirth}T00:00:00`));
    if (now.bloodGroup !== original.bloodGroup) await this.chooseBloodGroup(original.bloodGroup);
    if (text('address')) {
      await this.scrollTextHigh(EDIT_LABEL.address);
      await setText(EDIT_LABEL.address, original.address);
      await this.hideKeyboard();
    }
    if (now.gender !== original.gender) {
      await this.scrollTextHigh(EDIT_LABEL.gender);
      await this.tap(this.byA11y(GENDER_A11Y[original.gender]), `gender ${original.gender}`);
    }
    if (now.heightCm !== original.heightCm || now.weightKg !== original.weightKg) {
      await this.setHeightAndWeight(String(original.heightCm ?? ''), String(original.weightKg ?? ''));
    }
    if (text('emergencyContactName')) {
      await this.scrollTextHigh(EDIT_LABEL.emergencyName);
      await setText(EDIT_LABEL.emergencyName, original.emergencyContactName);
      await this.hideKeyboard();
    }
    if (lists) {
      await this.openAllergiesTab();
      for (let name of [...extraAllergies, ...extraConditions]) await this.removeChip(name);
      for (let name of missingAllergies) await this.addAllergy(name);
      for (let name of missingConditions) await this.tickCondition(CONDITIONS.find((p) => p.name === name)!);
    }
    await this.saveHealthEdit();
  }

  // Change two fields, then Cancel instead of Save.
  async changeThenCancel(edits: ProfileEdits) {
    await this.openEditProfile();
    await this.chooseBloodGroup(edits.bloodGroup);
    await this.setHeightAndWeight(String(edits.heightCm), String(edits.weightKg));
    await this.cancelEdit();
  }

  // ------------------------------------------------------------- validation

  // The validation-looking lines among `texts`, so a failure says what the app showed instead.
  private messagesIn(texts: string[]): string {
    let found = texts.filter((t) => /must|invalid|required|can't|cannot|incorrect|characters|future|too |enter/i.test(t));
    return found.length > 0 ? found.map((t) => `"${t}"`).join(' | ') : 'none';
  }

  private async saveAndCollect(): Promise<string[]> {
    await this.save();
    await d().waitUntil(async () => (await this.visibleTexts()).length > 0, { timeout: TIMEOUTS.visible });
    return this.allTexts();
  }

  // One pass through every rule. The app checks in two stages — the form's own
  // rules (name, DOB, phone) first, the health-metric ranges only once those
  // pass (observed 2026-09-25) — so the ranges get a save each. Every missing
  // message is collected before failing, so one run reports all of them.
  async expectEveryInvalidValueRejected(invalid: {
    futureDateOfBirth: Date; emergencyPhone: string; weightTooHigh: string; heightTooLow: string;
  }, account: CustomerProfile) {
    let faults: string[] = [];
    let check = (texts: string[], message: string, what: string) => {
      if (!texts.includes(message)) faults.push(`${what}: no "${message}" — messages on screen: ${this.messagesIn(texts)}`);
      if (texts.includes(PROFILE_TEXT.savedToast)) faults.push(`${what}: the form SAVED ("${PROFILE_TEXT.savedToast}")`);
    };

    await this.openEditProfile();
    // The mobile number is the login identifier: shown, but locked.
    if ((await this.fieldWithText(this.phoneShown(account.phone)).getAttribute('enabled')) !== 'false') faults.push('the mobile number is EDITABLE');
    if (!(await this.visibleTexts()).includes(VIEW_LABEL.mobileLockedNote)) faults.push(`no "${VIEW_LABEL.mobileLockedNote}" note`);
    await this.tap(this.fieldBelow(EDIT_LABEL.firstName), 'First name');
    await this.focusedField().clearValue();
    await this.hideKeyboard();
    await this.setDateOfBirth(invalid.futureDateOfBirth);
    await this.setEmergencyPhone(invalid.emergencyPhone);
    let texts = await this.saveAndCollect();
    check(texts, VALIDATION_TEXT.firstNameRequired, 'empty first name');
    check(texts, VALIDATION_TEXT.dobInFuture, 'future date of birth');
    check(texts, VALIDATION_TEXT.phoneInvalid, `emergency phone "${invalid.emergencyPhone}"`);
    await this.cancelEdit();

    let ranges: Array<[string, string, string, string]> = [
      ['weight', invalid.weightTooHigh, VALIDATION_TEXT.weightTooHigh, 'weight'],
      ['height', invalid.heightTooLow, VALIDATION_TEXT.heightTooLow, 'height'],
    ];
    for (let [field, value, message] of ranges) {
      await this.openEditProfile();
      await this.scrollTextHigh(EDIT_LABEL.height);
      await this.replaceIn(field === 'weight' ? this.weightField : this.heightField, value, field);
      await this.closeKeypad(this.keypadDone);
      check(await this.saveAndCollect(), message, `${field} ${value}`);
      await this.cancelEdit();
    }

    if (faults.length > 0) throw new Error(`Invalid values were not all rejected:\n  - ${faults.join('\n  - ')}`);
  }

  // --------------------------------------------------------------- the view

  // My Profile shows what the account holds. Also: the mobile number is locked.
  async expectProfileShowsAccount(account: CustomerProfile) {
    await this.openProfile();
    let texts = await this.allTexts();
    let faults: string[] = [];
    let expectText = (value: string, what: string) => { if (!texts.includes(value)) faults.push(`${what} "${value}" not shown`); };

    expectText(`${account.firstName} ${account.lastName}`, 'name');
    expectText(this.phoneShown(account.phone), 'phone');
    expectText(account.email, 'email');
    if (this.valueAfter(texts, VIEW_LABEL.dateOfBirth) !== this.longDate(account.dateOfBirth)) {
      faults.push(`date of birth "${this.valueAfter(texts, VIEW_LABEL.dateOfBirth)}" (expected "${this.longDate(account.dateOfBirth)}")`);
    }
    expectText(account.bloodGroup, 'blood group');
    if (account.heightCm !== null) expectText(String(account.heightCm), 'height');
    if (account.weightKg !== null) expectText(String(account.weightKg), 'weight');
    if (account.bmi !== null) expectText(account.bmi.toFixed(1), 'BMI'); // shown with one decimal: "28.0" (device-verified 2026-10-07)
    if (account.bmiCategory) expectText(account.bmiCategory, 'BMI category');
    let gender = await this.selectedGender();
    if (gender !== GENDER_A11Y[account.gender]) faults.push(`gender "${gender}" selected (expected "${GENDER_A11Y[account.gender]}")`);

    if (faults.length > 0) throw new Error(`My Profile does not match the account:\n  - ${faults.join('\n  - ')}`);
  }

  // After a save: My Profile shows every edited value, read fresh from the screen.
  async expectProfileShowsEdits(edits: ProfileEdits) {
    await this.openProfile();
    let texts = await this.allTexts();
    let faults: string[] = [];
    let expectAfter = (label: string, value: string, what: string) => {
      let shown = this.valueAfter(texts, label);
      if (shown !== value) faults.push(`${what} "${shown}" (expected "${value}")`);
    };
    let expectText = (value: string, what: string) => { if (!texts.includes(value)) faults.push(`${what} "${value}" not shown`); };

    expectText(`${edits.firstName} ${edits.lastName}`, 'name');
    expectAfter(VIEW_LABEL.dateOfBirth, this.longDate(edits.dateOfBirth), 'date of birth');
    expectText(edits.bloodGroup, 'blood group');
    expectAfter(VIEW_LABEL.address, edits.address, 'address');
    expectText(String(edits.heightCm), 'height');
    expectText(String(edits.weightKg), 'weight');
    let bmi = this.bmi(edits.heightCm, edits.weightKg);
    if (!texts.includes(bmi) && !texts.includes(bmi.replace(/\.0$/, ''))) faults.push(`BMI ${bmi} not shown`);
    expectAfter(VIEW_LABEL.emergencyName, edits.emergencyName, 'emergency contact name');
    expectAfter(VIEW_LABEL.emergencyPhone, this.phoneShown(edits.emergencyPhone), 'emergency contact phone');
    let gender = await this.selectedGender();
    if (gender !== GENDER_A11Y[edits.gender]) faults.push(`gender "${gender}" selected (expected "${GENDER_A11Y[edits.gender]}")`);

    if (faults.length > 0) throw new Error(`My Profile does not show the saved edits:\n  - ${faults.join('\n  - ')}`);
  }

  // ------------------------------------------------------------------ photo

  // Change photo → system picker → the pushed photo (newest, so first) → Done.
  // The app checks the pixel size and uploads straight away, before Save.
  async changePhotoTo(localPath: string) {
    pushToGallery(localPath, `qa-${Date.now()}-${path.basename(localPath)}`);
    await this.openEditProfile();
    await this.scrollToTop();
    await this.tap(this.byA11y(PROFILE_A11Y.changePhoto), 'Change photo');
    await this.tap(this.byA11yPrefix(PHOTO_PICKER.itemPrefix), 'newest photo in the picker');
    await this.tap(this.byText(PHOTO_PICKER.done), 'picker Done');
    await this.waitVisible(this.saveChanges, 'Edit Profile after picking the photo');
    let last = '';
    await d().waitUntil(
      async () => {
        let now = (await this.visibleTexts()).join('|');
        let settled = now === last && !now.includes('0.0'); // "0.0" is the upload progress
        last = now;
        return settled;
      },
      { timeout: TIMEOUTS.content, interval: 1000, timeoutMsg: 'The photo upload never finished.' },
    );
  }

  async expectPhotoReplaced(before: string | null, after: string | null) {
    if ((await this.visibleTexts()).includes(PROFILE_TEXT.photoUploadFailed)) {
      throw new Error(`The upload failed: "${PROFILE_TEXT.photoUploadFailed}".`);
    }
    if (!after || after === before) throw new Error(`The profile photo did not change (still ${before}).`);
    await this.cancelEdit();
  }

  // The refusal is the app's own pixel check: an inline banner naming the photo's size.
  async expectPhotoRefusedAsTooLarge(photo: SizedPhoto, before: string | null, after: string | null) {
    await this.waitForText(PROFILE_TEXT.photoTooLarge.replace('{size}', `${photo.width}×${photo.height}`));
    if (after !== before) throw new Error(`A refused photo still replaced the profile photo: ${before} → ${after}.`);
    await this.cancelEdit();
  }

  async expectPhotoRefusedAsWrongType(before: string | null, after: string | null) {
    await this.waitForText(PROFILE_TEXT.photoWrongType);
    if (after !== before) throw new Error(`A refused photo still replaced the profile photo: ${before} → ${after}.`);
    await this.cancelEdit();
  }

  // ------------------------------------------------ known defects (skipped)

  private async saveAndRead(): Promise<string[]> {
    await this.save();
    await d().waitUntil(async () => false, { timeout: 2500 }).catch(() => undefined);
    return this.allTexts();
  }

  // findings: "An emergency contact phone can never be removed".
  async clearEmergencyPhoneAndExpectItGone() {
    await this.openEditProfile();
    await this.scrollTextHigh(EDIT_LABEL.emergencyPhone);
    await this.tap(this.fieldBelow(EDIT_LABEL.emergencyPhone), 'Emergency Contact Phone');
    await this.focusedField().clearValue();
    await this.closeKeypad(this.keypadDone);
    await this.saveHealthEdit();
    let shown = this.valueAfter(await this.allTexts(), VIEW_LABEL.emergencyPhone);
    if (shown !== '—') throw new Error(`The emergency phone was cleared and saved, but My Profile still shows "${shown}".`);
  }

  // findings: "An invalid emergency phone on its own saves with a success message".
  async expectInvalidEmergencyPhoneAloneRejected(phone: string) {
    await this.openEditProfile();
    await this.setEmergencyPhone(phone);
    let texts = await this.saveAndRead();
    let faults: string[] = [];
    if (texts.includes(PROFILE_TEXT.savedToast)) faults.push(`"${phone}" SAVED with "${PROFILE_TEXT.savedToast}"`);
    if (!texts.includes(VALIDATION_TEXT.phoneInvalid)) faults.push(`no "${VALIDATION_TEXT.phoneInvalid}"`);
    if (texts[0] === PROFILE_TEXT.editHeading) await this.cancelEdit();
    if (faults.length > 0) throw new Error(`An invalid emergency phone on its own:\n  - ${faults.join('\n  - ')}`);
  }

  // findings: "A height above the maximum is refused with no message" and
  // "Height 0 and weight 0 are accepted and the profile saves".
  async expectHealthMetricLimitsEnforced(heightTooHigh: string) {
    let faults: string[] = [];
    await this.openEditProfile();
    await this.setHeightAndWeight('0', '0');
    let zeros = await this.saveAndRead();
    if (zeros.includes(PROFILE_TEXT.savedToast)) faults.push(`height 0 / weight 0 SAVED with "${PROFILE_TEXT.savedToast}"`);
    for (let message of [VALIDATION_TEXT.heightTooLow, VALIDATION_TEXT.weightTooLow]) if (!zeros.includes(message)) faults.push(`height 0 / weight 0: no "${message}"`);
    if (zeros[0] === PROFILE_TEXT.editHeading) await this.cancelEdit();

    await this.openEditProfile();
    await this.scrollTextHigh(EDIT_LABEL.height);
    await this.replaceIn(this.heightField, heightTooHigh, 'Height (cm)');
    await this.closeKeypad(this.keypadDone);
    let high = await this.saveAndRead();
    if (!high.some((t) => /^Height must be at most/.test(t))) faults.push(`height ${heightTooHigh} cm is refused with no message`);
    if (high[0] === PROFILE_TEXT.editHeading) await this.cancelEdit();

    if (faults.length > 0) throw new Error(`Health-metric limits:\n  - ${faults.join('\n  - ')}`);
  }

  // findings: "Edit Profile opens from a cached profile".
  async expectFormShowsAllergy(name: string) {
    await this.openEditProfile();
    await this.openAllergiesTab();
    let shown = await this.isVisible(this.byA11y(`${PROFILE_A11Y.removeChipPrefix}${name}`));
    await this.cancelEdit();
    if (!shown) throw new Error(`"${name}" was added outside the app, but Edit Profile does not show it — the form is stale.`);
  }

  // findings: "A missing current password is reported as a password-length error".
  async expectMissingCurrentPasswordIsNamed(newPassword: string) {
    await this.openPasswordChange();
    await this.submitPasswords('', newPassword);
    await d().waitUntil(async () => false, { timeout: 2500 }).catch(() => undefined);
    let texts = await this.visibleTexts();
    await this.cancelEdit();
    let faults: string[] = [];
    if (texts.includes(PROFILE_TEXT.savedToast)) faults.push('the change SAVED');
    if (texts.includes(VALIDATION_TEXT.passwordTooShort)) faults.push(`a valid ${newPassword.length}-character password is reported as "${VALIDATION_TEXT.passwordTooShort}"`);
    if (!texts.some((t) => /current password/i.test(t) && t !== EDIT_LABEL.currentPassword && t !== EDIT_HINT.currentPassword)) faults.push('no message asks for the current password');
    if (faults.length > 0) throw new Error(`An empty current password:\n  - ${faults.join('\n  - ')}`);
  }

  // --------------------------------------------------------------- password

  private get currentPasswordField() {
    return this.hintField(EDIT_HINT.currentPassword);
  }

  private get newPasswordField() {
    return this.hintField(EDIT_HINT.newPassword);
  }

  private async openPasswordChange() {
    await this.openEditProfile();
    // Only into reach: pushing Gender high threw the expanded block above the top (2026-09-29).
    await this.scrollFieldIntoReach(EDIT_LABEL.gender);
    await this.tap(this.byA11y(PROFILE_A11Y.changePassword), 'Change password');
    await this.scrollTextHigh(EDIT_LABEL.currentPassword);
    await this.waitForText(EDIT_LABEL.currentPassword);
  }

  private async submitPasswords(current: string, next: string) {
    if (current) await this.currentPasswordField.setValue(current);
    if (next) await this.newPasswordField.setValue(next);
    await this.hideKeyboard();
    await this.save();
  }

  async changePassword(current: string, next: string) {
    await this.openPasswordChange();
    await this.submitPasswords(current, next);
    await this.waitForText(PROFILE_TEXT.savedToast);
  }

  // There is NO confirm-password field (crawl 2026-09-25), so a mismatch cannot
  // be entered. Two rules are checked here: length and a wrong current password.
  // A MISSING current password is a known defect — expectMissingCurrentPasswordIsNamed.
  async expectPasswordRulesEnforced(passwords: { tooShort: string; wrongCurrent: string; temporary: string }) {
    let faults: string[] = [];
    let attempt = async (current: string, next: string) => {
      await this.openPasswordChange();
      await this.submitPasswords(current, next);
      await d().waitUntil(async () => false, { timeout: 2500 }).catch(() => undefined);
      let texts = await this.visibleTexts();
      await this.cancelEdit();
      return texts;
    };

    let short = await attempt(passwords.temporary, passwords.tooShort);
    if (!short.includes(VALIDATION_TEXT.passwordTooShort)) faults.push(`a ${passwords.tooShort.length}-character new password: no "${VALIDATION_TEXT.passwordTooShort}" — messages on screen: ${this.messagesIn(short)}`);

    let wrong = await attempt(passwords.wrongCurrent, passwords.temporary);
    if (!wrong.includes(VALIDATION_TEXT.currentPasswordWrong)) faults.push(`a wrong current password: no "${VALIDATION_TEXT.currentPasswordWrong}" — messages on screen: ${this.messagesIn(wrong)}`);

    if (faults.length > 0) throw new Error(`Password rules:\n  - ${faults.join('\n  - ')}`);
  }
}
