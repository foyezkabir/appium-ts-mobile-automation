import * as api from './client';
import { ErrorHelper } from '../support/ErrorHelper';

// The profile as the run found it, so teardown can put every field back.
export async function snapshotProfile(): Promise<api.CustomerProfile> {
  return api.getProfile();
}

// NEVER THROWS. Puts back every field a profile test edits. The emergency
// contact PHONE cannot be cleared once set — PATCH ignores null and refuses ""
// (verified 2026-09-25), and the UI cannot clear it either — so it is restored
// only when the run found one.
export async function restoreProfile(original: api.CustomerProfile) {
  await ErrorHelper.warnOnFailure(async () => {
    await api.updateProfile({
      firstName: original.firstName,
      lastName: original.lastName,
      dateOfBirth: original.dateOfBirth,
      bloodGroup: original.bloodGroup,
      address: original.address,
      gender: original.gender,
      heightCm: original.heightCm,
      weightKg: original.weightKg,
      emergencyContactName: original.emergencyContactName,
      knownAllergies: original.knownAllergies,
      chronicConditions: original.chronicConditions,
      ...(original.emergencyContactPhone ? { emergencyContactPhone: original.emergencyContactPhone } : {}),
    });
  }, 'could not restore the profile the run found');
}

export async function currentPhotoUrl(): Promise<string | null> {
  return (await api.getProfile()).profilePhotoUrl;
}

// What the dashboard's quick-link tiles should count.
export async function dashboardCounts(): Promise<{ prescriptions: number; upcoming: number }> {
  let dashboard = await api.getDashboard();
  return { prescriptions: dashboard.activePrescriptions, upcoming: dashboard.upcomingAppointments };
}

// A change made OUTSIDE the app, as the web portal or a pharmacy would make it.
export async function seedAllergyOutsideTheApp(name: string) {
  let current = await api.getProfile();
  await api.updateProfile({ knownAllergies: [...current.knownAllergies, name] });
}

// Which restorable fields differ between two snapshots — no assertion, just the
// list, so teardown can tell whether the UI restore actually landed.
export function profileDifferences(now: api.CustomerProfile, original: api.CustomerProfile): string[] {
  let fields = ['firstName', 'lastName', 'dateOfBirth', 'bloodGroup', 'address', 'gender', 'heightCm', 'weightKg', 'emergencyContactName'] as const;
  let differ = fields.filter((f) => (now[f] ?? '') !== (original[f] ?? ''));
  let sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  if (!sameList(now.knownAllergies, original.knownAllergies)) differ.push('knownAllergies' as never);
  if (!sameList(now.chronicConditions, original.chronicConditions)) differ.push('chronicConditions' as never);
  return differ;
}
