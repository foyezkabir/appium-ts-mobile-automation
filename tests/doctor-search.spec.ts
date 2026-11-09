import { useSearch } from '../src/support/search.fixture';

describe('Doctor search and filters', () => {
  let fx = useSearch();

  test('TC-01: Verify that the doctor list opens from the dashboard and lists every doctor with name and speciality', async () => {
    await fx.booking.expectSelectDoctorIsOpen();
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);
  });

  test('TC-02: Verify that a doctor card shows the designation, former position, hospital, experience and BMDC registration', async () => {
    await fx.booking.expectDoctorCardShowsCredentials(fx.doctor);
    await fx.booking.expectDoctorCardShowsCredentials(fx.other);
  });

  test('TC-03: Verify that every listed doctor card shows a profile photo', async () => {
    await fx.booking.expectEveryDoctorCardHasAPhoto(2);
  });

  test('TC-04: Verify that tapping a doctor card opens that doctor profile', async () => {
    await fx.booking.openDoctorProfile(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorProfileIsOpen(fx.doctor.fullName);
  });

  test('TC-05: Verify that searching by doctor name filters the list and clearing the search restores it', async () => {
    await fx.booking.searchDoctor(fx.terms.partialName);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.clearDoctorSearch();
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.searchDoctor(fx.terms.fullName);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
  });

  test('TC-06: Verify that search is by doctor name only, as its placeholder says, so a speciality term finds nobody', async () => {
    await fx.booking.expectSearchPlaceholderIsNameOnly();
    await fx.booking.searchDoctor(fx.terms.speciality);
    await fx.booking.expectNoDoctorsFound();
  });

  test('TC-07: Verify that search ignores case and surrounding whitespace, and shows the empty state when nothing matches', async () => {
    await fx.booking.searchDoctor(fx.terms.lowercaseName);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);

    await fx.booking.clearDoctorSearch();
    await fx.booking.searchDoctor(fx.terms.padded);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);

    await fx.booking.clearDoctorSearch();
    await fx.booking.searchDoctor(fx.terms.noMatch());
    await fx.booking.expectNoDoctorsFound();
  });

  test('TC-08: Verify that the speciality chip row offers All plus the tenant specialities', async () => {
    await fx.booking.expectSpecialityChipsAreOffered(['All', fx.doctor.primarySpeciality, ...fx.doctor.additionalSpecialities]);
  });

  test('TC-09: Verify that a speciality chip filters the list and the All chip restores it', async () => {
    await fx.booking.tapSpecialityChip(fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.tapAllChip();
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
  });

  test('TC-10: Verify that a chip selection carries into the filter sheet and Reset there restores the full list', async () => {
    await fx.booking.tapSpecialityChip(fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.openFilters();
    await fx.booking.expectSpecialityIsSelectedInSheet(fx.doctor.primarySpeciality);

    await fx.booking.resetFilters(); // Reset applies and closes the sheet itself
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);
  });

  test('TC-11: Verify that the filter sheet opens with its speciality options and closes on apply', async () => {
    await fx.booking.openFilters();
    await fx.booking.expectFilterSheetIsOpen();
    await fx.booking.selectSpeciality(fx.specialities.main);
    await fx.booking.applyFilters();
    await fx.booking.expectFilterSheetIsClosed();
  });

  // Out of scope: the speciality filter is single-select by design.
  test.skip('TC-12: Verify that the speciality filter is single-select, so a second choice replaces the first', async () => {
    await fx.booking.openFilters();
    await fx.booking.selectSpeciality(fx.specialities.main);
    await fx.booking.selectSpeciality(fx.specialities.other);
    await fx.booking.expectSpecialityIsSelectedInSheet(fx.specialities.other);
    await fx.booking.expectSpecialityIsNotSelectedInSheet(fx.specialities.main);

    await fx.booking.applyFilters();
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.clearFilterViaSheet();
  });

  test('TC-13: Verify that the filter sheet offers a Location section with a Division dropdown', async () => {
    await fx.booking.openFilters();
    await fx.booking.expectLocationSectionIsShown();
    await fx.booking.resetFilters();
  });

  test('TC-14: Verify that choosing a division reveals the district dropdown', async () => {
    await fx.booking.openFilters();
    await fx.booking.selectDivision(fx.location.division);
    await fx.booking.expectDistrictBecameAvailable();
    await fx.booking.resetFilters();
  });

  test('TC-15: Verify that a speciality filter and a search term apply together', async () => {
    await fx.booking.openFilters();
    await fx.booking.selectSpeciality(fx.specialities.main);
    await fx.booking.applyFilters();
    await fx.booking.searchDoctor(fx.terms.partialName);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.clearDoctorSearch();
    await fx.booking.clearFilterViaSheet();
  });

  test('TC-16: Verify that a speciality filter excludes doctors of other specialities', async () => {
    await fx.booking.openFilters();
    await fx.booking.selectSpeciality(fx.specialities.main);
    await fx.booking.applyFilters();
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
    await fx.booking.expectDoctorIsNotListed(fx.other.fullName, fx.other.primarySpeciality);

    await fx.booking.clearFilterViaSheet(); // Reset applies and closes on its own
    await fx.booking.expectDoctorIsListed(fx.other.fullName, fx.other.primarySpeciality);
    await fx.booking.expectDoctorIsListed(fx.doctor.fullName, fx.doctor.primarySpeciality);
  });
});
