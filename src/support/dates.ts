// The DEVICE's calendar date as YYYY-MM-DD. Never toISOString(): that is the
// UTC date, which in Dhaka (UTC+6) is still yesterday until 6 AM — so "today"
// seeds would book yesterday and "Today, …" stamps would never match.
export function localDate(at: Date = new Date()): string {
  let pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

// "23 Sep 2026" — the stamp the Prescription screens print, in the DEVICE's
// local calendar. Month names spelled out here: en-GB's Intl gives "Sept".
// [2026-09-29] only double-digit days observed; a single digit is assumed unpadded.
export function dayMonthYear(iso: string): string {
  let at = new Date(iso);
  let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${at.getDate()} ${months[at.getMonth()]} ${at.getFullYear()}`;
}

// "29 Sep 2026, 6:46 PM" — the Prescription screens' date-and-time stamp (issued, follow-up), device-local.
export function dayMonthYearTime(iso: string): string {
  let at = new Date(iso);
  let hours = at.getHours() % 12 || 12;
  let minutes = String(at.getMinutes()).padStart(2, '0');
  return `${dayMonthYear(iso)}, ${hours}:${minutes} ${at.getHours() < 12 ? 'AM' : 'PM'}`;
}
