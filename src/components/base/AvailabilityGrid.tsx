import { useState } from 'react';
import { STAY_META, addDays, key, nice, nightsBetween, today } from '../../lib/booking';
import type { RoomCalendar } from '../../services/availability';

interface Props {
  calendars: Record<number, RoomCalendar | undefined>; // by room id
  checkIn: Date;
  checkOut: Date;
  loading?: boolean;
  guests?: number;                                     // rooms that sleep fewer are dimmed
  onPick?: (roomId: number, date: Date) => void;       // tap an open night to start a stay there
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// Rooms by nights. Open nights show that room's nightly rate (Hostex, display only); booked nights are striped.
export default function AvailabilityGrid({ calendars, checkIn, checkOut, loading, guests = 1, onPick }: Props) {
  const t = today();
  const [offset, setOffset] = useState(0);
  const span = 21;
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const base = addDays(checkIn, -2) < t ? t : addDays(checkIn, -2);
  const start = addDays(base, offset);
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const isBooked = (id: number, k: string) => !!calendars[id]?.blockedDates.has(k);
  const priceOf = (id: number, k: string) => calendars[id]?.priceByDate?.[k];

  const openPrices: number[] = [];
  for (const s of STAY_META) for (const d of days) { const k = key(d); const p = priceOf(s.id, k); if (p && !isBooked(s.id, k)) openPrices.push(p); }
  const lowest = openPrices.length ? Math.min(...openPrices) : null;
  const canBack = offset > 0 && start > t;
  const stayNights: string[] = [];
  for (let d = new Date(checkIn); d < checkOut; d = addDays(d, 1)) stayNights.push(key(d));

  return (
    <div className="ag">
      <div className="ag-hd">
        <div>
          <h3>Availability</h3>
          <p>Nightly rates, book direct. Tap an open night to start a stay there.</p>
        </div>
        <div className="ag-ctl">
          <button type="button" className="arw" disabled={!canBack} onClick={() => setOffset(o => Math.max(0, o - span))} aria-label="Earlier dates">‹</button>
          <button type="button" className="arw" onClick={() => setOffset(o => o + span)} aria-label="Later dates">›</button>
        </div>
      </div>
      <div className="ag-scroll">
        <div className="ag-grid" style={{ gridTemplateColumns: `${narrow ? 112 : 140}px repeat(${span}, minmax(${narrow ? 52 : 40}px, 1fr))` }}>
          <div className="ag-corner" />
          {days.map((d, i) => {
            const w = d.getDay(); const isToday = key(d) === key(t);
            const inStay = d >= checkIn && d < checkOut;
            const showMonth = i === 0 || d.getDate() === 1;
            return <div key={key(d)} className={'ag-day' + (w === 5 || w === 6 ? ' we' : '') + (isToday ? ' today' : '') + (inStay ? ' stay' : '') + (d.getDate() === 1 && i > 0 ? ' m1' : '')}>
              <em>{showMonth ? MON[d.getMonth()] : '\u00a0'}</em><span>{DOW[w]}</span><b>{d.getDate()}</b>
            </div>;
          })}
          {STAY_META.map(s => {
            const known = !!calendars[s.id];
            const small = s.sleeps < guests;
            // Highlight the stay only on rooms that can actually take it: every night open, minimum met, sleeps enough.
            const fits = known && !small && nightsBetween(checkIn, checkOut) >= s.minNights && !stayNights.some(k => isBooked(s.id, k));
            return [
              <div className={'ag-room' + (small ? ' dim' : '')} key={'n' + s.id}>{s.short.replace('The ', '')}<small>{small ? `Too small for ${guests}` : `Sleeps ${s.sleeps}${s.minNights > 1 ? ` · ${s.minNights} night min` : ''}`}</small></div>,
              ...days.map(d => {
                const k = key(d); const b = isBooked(s.id, k); const p = priceOf(s.id, k);
                const sel = fits && d >= checkIn && d < checkOut;
                const cls = 'ag-c' + (!known ? ' unk' : b ? ' b' : '') + (small ? ' dim' : '') + (sel && !b ? ' sel' : '') + (!b && p && p === lowest && !sel ? ' low' : '');
                const label = `${s.short.replace('The ', '')}, ${nice(d)}, ${!known ? 'loading' : b ? 'booked' : p ? money(p) + ' per night' : 'open'}`;
                return (!known || b || small)
                  ? <div key={s.id + k} className={cls} title={label} aria-label={label} />
                  : <button type="button" key={s.id + k} className={cls} title={label} aria-label={label} onClick={() => onPick?.(s.id, d)}>{p ? money(p) : ''}</button>;
              }),
            ];
          })}
        </div>
      </div>
      <div className="ag-legend">
        <span><i className="k-open" />Open, price per night</span>
        <span><i className="k-booked" />Booked</span>
        <span><i className="k-sel" />Your dates, rooms that fit</span>
        {lowest && <span><b>{money(lowest)}</b> lowest rate</span>}
        {loading && <span>Checking the calendar…</span>}
      </div>
    </div>
  );
}
