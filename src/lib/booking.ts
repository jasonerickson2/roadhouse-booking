// Shared booking helpers for the v6 redesign.
// Fees here mirror property_config and the pet fees observed on past reservations (Oct 2026).
// The server (booking-api) is the source of truth for nightly rate, cleaning and tax;
// the values below are only used for display before the API answers and for add ons the
// API does not yet price (pets, early check in, late checkout). See BUILD_NOTES.md.

export interface StayMeta {
  id: number;              // mocks/rooms.ts id, also booking-api roomId
  slug: string;
  name: string;
  short: string;
  kind: string;
  group: 'rooms' | 'suites' | 'house';
  sleeps: number;
  minNights: number;
  petFee: number;          // per stay
  maxPets: number;
  addOnFee: number;        // flat fee for early check in (2pm) or late checkout (11:30am). 0 = not offered
  addOnWeight: number;     // share of the lodge wide daily budget (ADDON_BUDGET_PER_DAY) this room uses
  tag?: string;
  season?: string;
}

export const STAY_META: StayMeta[] = [
  { id: 6, slug: 'room-1', name: 'Room 1', short: 'Room 1', kind: 'Lodge room', group: 'rooms', sleeps: 2, minNights: 1, petFee: 95, maxPets: 2, addOnFee: 25, addOnWeight: 1, tag: 'Guest favorite' },
  { id: 5, slug: 'room-2', name: 'Room 2', short: 'Room 2', kind: 'Lodge room', group: 'rooms', sleeps: 2, minNights: 1, petFee: 95, maxPets: 2, addOnFee: 25, addOnWeight: 1 },
  { id: 4, slug: 'room-3', name: 'Room 3', short: 'Room 3', kind: 'Lodge room', group: 'rooms', sleeps: 4, minNights: 1, petFee: 95, maxPets: 2, addOnFee: 25, addOnWeight: 1 },
  { id: 2, slug: 'penthouse', name: 'Penthouse', short: 'Penthouse', kind: 'Entire apartment', group: 'suites', sleeps: 4, minNights: 1, petFee: 125, maxPets: 2, addOnFee: 25, addOnWeight: 2 },
  { id: 3, slug: 'carriage-house', name: 'Cabin 5 - The Carriage House', short: 'Carriage House', kind: 'Standalone suite', group: 'suites', sleeps: 2, minNights: 2, petFee: 125, maxPets: 2, addOnFee: 25, addOnWeight: 1, tag: 'Guest favorite', season: 'May to Oct' },
  { id: 1, slug: 'grizzly-maze', name: 'The Grizzly Maze', short: 'The Grizzly Maze', kind: 'Whole house', group: 'house', sleeps: 8, minNights: 3, petFee: 185, maxPets: 2, addOnFee: 0, addOnWeight: 0, tag: 'Whole house' },
];

export const metaById = (id: number) => STAY_META.find(s => s.id === id);

// Lodge wide budget for add ons (owner, 2026-10-14): two early check ins or late checkouts a day in
// any mix, the Penthouse counts as two, Grizzly offers none. The server (booking-api) enforces it.
export const ADDON_BUDGET_PER_DAY = 2;
export const EARLY_LABEL = '2pm', LATE_LABEL = '11:30am';

// ---- dates ----
export const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const nice = (d: Date | null) => d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
export const nightsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
export const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

// ---- search state in the URL so every page agrees ----
export interface SearchState { checkIn: Date; checkOut: Date; guests: number; pets: number; }

export function readSearch(params: URLSearchParams): SearchState {
  const t = today();
  const ci = params.get('checkIn'); const co = params.get('checkOut');
  let checkIn = ci ? parseKey(ci) : t; if (isNaN(checkIn.getTime()) || checkIn < t) checkIn = t;
  let checkOut = co ? parseKey(co) : addDays(checkIn, 1); if (isNaN(checkOut.getTime()) || checkOut <= checkIn) checkOut = addDays(checkIn, 1);
  const guests = Math.min(8, Math.max(1, parseInt(params.get('guests') || '2') || 2));
  const pets = Math.min(2, Math.max(0, parseInt(params.get('pets') || '0') || 0));
  return { checkIn, checkOut, guests, pets };
}
export function writeSearch(s: SearchState, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ checkIn: key(s.checkIn), checkOut: key(s.checkOut), guests: String(s.guests), pets: String(s.pets), ...extra });
  return p.toString();
}

// ---- cancellation policy (same rules as booking-api and direct-booking-settle) ----
// Summer runs from the Saturday of Memorial Day weekend through October 31, computed per year the
// same way booking-api does, so the label the guest sees is the one the server enforces.
export function season(d: Date): 'summer' | 'winter' {
  const y = d.getFullYear();
  const memorialDay = new Date(y, 4, 31); memorialDay.setDate(31 - memorialDay.getDay() + 1); // last Monday of May
  const start = new Date(memorialDay); start.setDate(memorialDay.getDate() - 2);
  const end = new Date(y, 9, 31, 23, 59, 59);
  return d >= start && d <= end ? 'summer' : 'winter';
}
export function policy(d: Date) {
  return season(d) === 'summer'
    ? { label: 'Summer cancellation policy (Memorial Day weekend to October 31)', rules: ['30 or more days before check in: full refund', '14 to 30 days before check in: 50% refund', 'Under 14 days: no refund', 'Processing fees are not refundable'] }
    : { label: 'Winter cancellation policy (November 1 to Memorial Day)', rules: ['14 or more days before check in: full refund', '7 to 14 days before check in: 50% refund', 'Under 7 days: no refund', 'Processing fees are not refundable'] };
}

// ---- add on pricing on top of the API quote ----
export const TAX_RATE = 0.029 + 0.04 + 0.019; // CO state, Lake County, lodging
export const SERVICE_RATE = 0.02;

export interface Extras { pets: number; earlyHours: 0 | 2; late: boolean; }

export function extrasTotal(meta: StayMeta, x: Extras) {
  const pet = x.pets > 0 ? meta.petFee : 0;
  const early = x.earlyHours > 0 && meta.addOnFee > 0 ? meta.addOnFee : 0;
  const late = x.late && meta.addOnFee > 0 ? meta.addOnFee : 0;
  const sub = pet + early + late;
  const tax = sub * TAX_RATE, fee = sub * SERVICE_RATE;
  return { pet, early, late, sub, tax, fee, total: sub + tax + fee };
}
export function extrasNote(meta: StayMeta, x: Extras) {
  const parts: string[] = [];
  if (x.pets > 0) parts.push(`${x.pets} pet${x.pets > 1 ? 's' : ''} (${fmt(meta.petFee)})`);
  if (x.earlyHours > 0 && meta.addOnFee > 0) parts.push(`Early check in ${EARLY_LABEL} (${fmt(meta.addOnFee)})`);
  if (x.late && meta.addOnFee > 0) parts.push(`Late checkout ${LATE_LABEL} (${fmt(meta.addOnFee)})`);
  return parts.join(', ');
}
