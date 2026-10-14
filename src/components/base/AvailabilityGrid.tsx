import { useState } from 'react';
import { STAY_META, addDays, key, nice, today } from '../../lib/booking';
import type { RoomCalendar } from '../../services/availability';

interface Props {
  calendars: Record<number, RoomCalendar | undefined>; // by room id
  checkIn: Date;
  checkOut: Date;
  loading?: boolean;
}

// Six rows by 21 days. Solid cell with × is booked, white is open, outline is the guest's range.
export default function AvailabilityGrid({ calendars, checkIn, checkOut, loading }: Props) {
  const [cap, setCap] = useState('Tap a day to see which rooms are open.');
  const t = today();
  const start = addDays(checkIn, -2) < t ? t : addDays(checkIn, -2);
  const days = Array.from({ length: 21 }, (_, i) => addDays(start, i));
  const isBooked = (id: number, k: string) => !!calendars[id]?.blockedDates.has(k);

  function tap(d: Date) {
    const k = key(d);
    const open = STAY_META.filter(s => calendars[s.id] && !isBooked(s.id, k)).map(s => s.short.replace('The ', ''));
    const booked = STAY_META.filter(s => isBooked(s.id, k)).map(s => s.short.replace('The ', ''));
    setCap(`${nice(d)}: ${open.length ? 'open: ' + open.join(', ') : 'nothing open'}${booked.length ? ' · booked: ' + booked.join(', ') : ''}`);
  }

  return (
    <div className="grid-wrap" style={{ marginTop: 12 }}>
      <div className="tape-scroll">
        <div className="tape">
          <div className="rn" style={{ fontWeight: 700 }}>Next 3 weeks</div>
          {days.map(d => <div className="hd" key={key(d)}><span>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span><span>{d.getDate()}</span></div>)}
          {STAY_META.map(s => (
            <RowCells key={s.id} name={s.short.replace('The ', '')} days={days} id={s.id} isBooked={isBooked} checkIn={checkIn} checkOut={checkOut} onTap={tap} known={!!calendars[s.id]} />
          ))}
        </div>
      </div>
      <div className="tape-legend"><span><i style={{ background: '#fff' }} />Open</span><span><i style={{ background: '#6E6A62', borderColor: '#6E6A62' }} />Booked</span><span><i style={{ background: 'var(--sage)', borderColor: 'var(--ink)' }} />Your dates</span></div>
      <div className="tape-cap">{loading ? 'Checking the calendar…' : cap}</div>
    </div>
  );
}

function RowCells({ name, days, id, isBooked, checkIn, checkOut, onTap, known }: { name: string; days: Date[]; id: number; isBooked: (id: number, k: string) => boolean; checkIn: Date; checkOut: Date; onTap: (d: Date) => void; known: boolean }) {
  return (
    <>
      <div className="rn">{name}</div>
      {days.map(d => {
        const k = key(d); const b = isBooked(id, k); const sel = d >= checkIn && d < checkOut;
        return <div key={k} className={'c' + (b ? ' b' : '') + (sel ? ' sel' : '')} style={known ? undefined : { opacity: .4 }} title={`${name} ${nice(d)} ${b ? 'booked' : 'open'}`} onClick={() => onTap(d)} />;
      })}
    </>
  );
}
