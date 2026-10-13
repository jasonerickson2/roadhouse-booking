import { useState } from 'react';
import { addDays, key, parseKey, today } from '../../lib/booking';

interface Props {
  checkIn: Date;
  checkOut: Date;
  onChange: (checkIn: Date, checkOut: Date) => void;
  blocked?: Set<string>;        // nights that cannot be part of the stay
  noArrival?: Set<string>;      // dates that cannot be a check in
  months?: number;              // 1 on phone, 2 on desktop
  inline?: boolean;
}

// Two step range picker. First tap sets check in, second tap sets check out.
// A range that crosses a blocked night is rejected and the second tap becomes the new check in.
export default function RangeCalendar({ checkIn, checkOut, onChange, blocked, noArrival, months = 2, inline }: Props) {
  const [pick, setPick] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => new Date(checkIn.getFullYear(), checkIn.getMonth(), 1));
  const t = today();

  function crossesBlocked(a: Date, b: Date) {
    if (!blocked) return false;
    for (let d = new Date(a); d < b; d = addDays(d, 1)) if (blocked.has(key(d))) return true;
    return false;
  }
  function tap(k: string) {
    const dt = parseKey(k);
    if (!pick || dt <= pick) { setPick(dt); return; }
    if (crossesBlocked(pick, dt)) { setPick(dt); return; }
    onChange(pick, dt); setPick(null);
  }

  const a = pick || checkIn, b = pick ? null : checkOut;
  const blocks = [];
  for (let k = 0; k < months; k++) {
    const m = new Date(month.getFullYear(), month.getMonth() + k, 1);
    const first = m.getDay(); const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(<span key={'e' + i} />);
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(m.getFullYear(), m.getMonth(), d); const k2 = key(dt);
      let cls = 'day'; let disabled = false;
      if (dt < t) { cls += ' off'; disabled = true; }
      else if (blocked && blocked.has(k2)) { cls += ' booked'; disabled = true; }
      else if (!pick && noArrival && noArrival.has(k2)) { cls += ' off'; disabled = true; }
      if (key(a) === k2) cls += ' start';
      if (b && key(b) === k2) cls += ' end';
      if (b && dt > a && dt < b) cls += ' in';
      cells.push(<button type="button" key={k2} className={cls} disabled={disabled} onClick={() => tap(k2)} aria-label={dt.toDateString()}>{d}</button>);
    }
    blocks.push(
      <div className="month" key={k}>
        <div className="mh">
          {k === 0 ? <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button> : <span />}
          <span>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          {k === months - 1 ? <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button> : <span />}
        </div>
        <div className="dow"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
        <div className="days">{cells}</div>
      </div>
    );
  }
  return (
    <div className={'cal open' + (inline ? ' inline' : '')}>
      {blocks}
      <div className="legend">{blocked && <span><i />Booked</span>}<span>{pick ? 'Now tap your check out day' : 'Tap check in, then check out'}</span></div>
    </div>
  );
}
