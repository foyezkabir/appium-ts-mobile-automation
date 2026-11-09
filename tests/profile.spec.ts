import { useProfile } from '../src/support/profile.fixture';
import {
  seedAppointment, currentPhotoUrl, dashboardCounts,
  rememberPasswordInFlight, changePasswordBackByApi, photos, oversizePhotos, seedAllergyOutsideTheApp,
} from '../src/support/profile.kit';

describe('Profile and dashboard', () => {
  let fx = useProfile();

  test('TC-01: Verify that editing every field except email and password saves, persists on My Profile, and reaches the dashboard — age included, on the birthday edge', async () => {
    await fx.profile.editEveryField(fx.edits);
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectHealthTilesShowEdits(fx.edits, fx.original);
    await fx.profile.expectProfileShowsEdits(fx.edits);
  });

  test('TC-02: Verify that allergies and conditions added, removed, and entered under Others are counted and named on the dashboard and kept on the form', async () => {
    await fx.profile.addAllergiesAndConditions(fx.health.allergies, fx.health.conditions);
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectAllergyAndConditionTiles(fx.health.tiles.added);

    await fx.profile.removeAllergyAndCondition(fx.health.allergies[1], fx.health.conditions[1]);
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectAllergyAndConditionTiles(fx.health.tiles.afterRemoval);

    await fx.profile.addCustomCondition(fx.health.custom);
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectAllergyAndConditionTiles(fx.health.tiles.withCustom);
    await fx.profile.expectCustomConditionKept(fx.health.custom);
  });

  test('TC-03: Verify that Cancel discards the edits and My Profile still shows the account', async () => {
    await fx.profile.changeThenCancel(fx.edits);
    await fx.profile.expectProfileShowsAccount(fx.original);
  });

  test('TC-04: Verify that every invalid value is rejected with its own message, nothing is saved, and the mobile number is locked', async () => {
    await fx.profile.expectEveryInvalidValueRejected(fx.invalid, fx.original);
    await fx.profile.expectProfileShowsAccount(fx.original);
  });

  test('TC-05: Verify that a JPEG and a PNG photo within 512×512 px each replace the profile photo', async () => {
    fx.photoBefore = await currentPhotoUrl();
    await fx.profile.changePhotoTo(photos.jpeg);
    await fx.profile.expectPhotoReplaced(fx.photoBefore, await currentPhotoUrl());

    fx.photoBefore = await currentPhotoUrl();
    await fx.profile.changePhotoTo(photos.png);
    await fx.profile.expectPhotoReplaced(fx.photoBefore, await currentPhotoUrl());
  });

  test('TC-06: Verify that a photo over 512×512 px is refused with a message naming its size, and the previous photo stays', async () => {
    fx.photoBefore = await currentPhotoUrl();
    await fx.profile.changePhotoTo(oversizePhotos.bothSides.file);
    await fx.profile.expectPhotoRefusedAsTooLarge(oversizePhotos.bothSides, fx.photoBefore, await currentPhotoUrl());
  });

  test('TC-07: Verify that the Prescription tile counts and opens My Prescriptions, and the Appointment tile counts the upcoming appointments', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    fx.counts = await dashboardCounts();
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectPrescriptionTileCounts(fx.counts.prescriptions);
    await fx.dashboard.openPrescriptionTile();
    await fx.dashboard.expectPrescriptionListOpenedWith(fx.counts.prescriptions);

    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.expectAppointmentTileCounts(fx.counts.upcoming);
  });

  // LAST live case: it changes the real login password and puts it back.
  test('TC-08: Verify that the password rules hold, a changed password refuses the old one and signs in with the new, and the old one works again once set back', async () => {
    await fx.profile.expectPasswordRulesEnforced(fx.passwords);

    await rememberPasswordInFlight(fx.passwords.temporary); // lets teardown undo it if this run dies
    await fx.profile.changePassword(fx.originalPassword, fx.passwords.temporary);
    await fx.login.logOutAfterPasswordChange();
    await fx.login.signInWith(fx.email, fx.originalPassword);
    await fx.login.expectInvalidCredentialsError();
    await fx.login.resubmitWith(fx.email, fx.passwords.temporary);
    await fx.login.expectLoginSucceeded();

    await fx.login.logOutIfLoggedIn();
    await changePasswordBackByApi(fx.passwords.temporary); // back to the .env password
    await fx.login.signInWith(fx.email, fx.originalPassword);
    await fx.login.expectLoginSucceeded();
  });

  // ── KNOWN DEFECTS — each in findings/profile.txt. Written and SKIPPED:
  // un-skip when the fix ships; green then proves the fix.

  test('TC-09: Verify that a photo one pixel over the limit on one side only is refused, naming that exact size', async () => {
    fx.photoBefore = await currentPhotoUrl();
    await fx.profile.changePhotoTo(oversizePhotos.oneSide.file);
    await fx.profile.expectPhotoRefusedAsTooLarge(oversizePhotos.oneSide, fx.photoBefore, await currentPhotoUrl());
  });

  test.skip('TC-10: [DEFECT] Verify that the Appointment tile opens the Upcoming tab even when Bookings was left on Past', async () => {
    fx.seeded = await seedAppointment(fx.doctor);
    await fx.appointments.openUpcomingList();
    await fx.appointments.openPast();
    await fx.dashboard.openHomeReloaded();
    await fx.dashboard.openAppointmentTile();
    await fx.appointments.expectUpcomingRowShows(fx.seeded, fx.doctor.primarySpeciality);
  });

  test('TC-11: [DEFECT] Verify that an empty current password is reported as missing, not as a length error', async () => {
    await fx.profile.expectMissingCurrentPasswordIsNamed(fx.passwords.temporary);
  });

  test.skip('TC-12: [DEFECT] Verify that a saved emergency contact phone can be cleared', async () => {
    await fx.profile.clearEmergencyPhoneAndExpectItGone();
  });

  test.skip('TC-13: [DEFECT] Verify that an invalid emergency phone on its own is rejected, not saved with a success message', async () => {
    await fx.profile.expectInvalidEmergencyPhoneAloneRejected(fx.invalid.emergencyPhone);
  });

  test.skip('TC-14: [DEFECT] Verify that the health-metric limits hold: height 0 and weight 0 are refused with their messages, and a height over the maximum has one', async () => {
    await fx.profile.expectHealthMetricLimitsEnforced(fx.invalid.heightTooHigh);
  });

  test.skip('TC-15: [DEFECT] Verify that Edit Profile shows an allergy added outside the app, without a restart', async () => {
    await seedAllergyOutsideTheApp(fx.outsideAllergy);
    await fx.profile.expectFormShowsAllergy(fx.outsideAllergy);
  });

  test('TC-16: Verify that a WebP and a HEIC photo are refused with the file-type message, and the previous photo stays', async () => {
    fx.photoBefore = await currentPhotoUrl();
    await fx.profile.changePhotoTo(photos.webp);
    await fx.profile.expectPhotoRefusedAsWrongType(fx.photoBefore, await currentPhotoUrl());

    await fx.profile.changePhotoTo(photos.heic);
    await fx.profile.expectPhotoRefusedAsWrongType(fx.photoBefore, await currentPhotoUrl());
  });
});
