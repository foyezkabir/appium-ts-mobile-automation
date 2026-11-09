import type { NavigationPage } from '../pages/navigation.page';
import type { AppointmentsPage } from '../pages/appointments.page';
import { NAV_A11Y } from '../locators/nav.locators';

// Teardown for the booking module.

// Cancel an upcoming appointment with the given doctor, if one exists.
export async function cancelAppointmentIfPresent(
  nav: NavigationPage,
  appointments: AppointmentsPage,
  doctorName: string,
): Promise<void> {
  try {
    await nav.openTab(NAV_A11Y.bookings);
    await appointments.openUpcoming();

    if ((await appointments.countRowsFor(doctorName)) === 0) return;

    await appointments.openAppointment(doctorName);
    await appointments.cancelOpenAppointment();
  } catch (error) {
    // Warn, never throw. The appointment stays greppable by doctor name in the
    // Upcoming list, so a leak is recoverable by hand.
    console.warn(
      `[teardown] Could not cancel the appointment for "${doctorName}". ` +
        `It may still exist in Upcoming and will need cancelling by hand. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Cancel every appointment this run created, across all fixture doctors.
export async function cleanupBookedAppointments(
  nav: NavigationPage,
  appointments: AppointmentsPage,
  doctorNames: string[],
): Promise<void> {
  for (let name of doctorNames) {
    await cancelAppointmentIfPresent(nav, appointments, name);
  }
}
