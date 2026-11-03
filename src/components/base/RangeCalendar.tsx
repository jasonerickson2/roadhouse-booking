import { useMemo, useState } from 'react';
import { addDays, key, parseKey, today } from '../../lib/booking';

interface Props {
  checkIn: Date;
  checkOut: Date;
  onChange: (checkIn: Date, checkOut: Date) => void;
  blocked?: Set<string>;                  // nights that cannot be part of the stay
  noArrival?: Set<string>;                // dates that cannot be a check in
  minNights?: Record<string, number>;     // minimum stay when checking in on that date
  nightly?: Record<string, number>;       // price per night, shown in the cell when known
  months?: number;                        // 1 on phone, 2 on desktop
  inline?: boolean;
}

const MONTHS_AHEAD = 18;
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Two step range picker in the pattern guests know from Airbnb.
//   - past and blocked nights are struck through
//   - a night you can leave on but not sleep on is "checkout only" and half shaded
//   - after the first tap, nights that would break the minimum stay or cross a block gray out
//   - hovering previews the range; the ends are solid circles, the span is a soft band
export default function RangeCalendar({ checkIn, checkOut, onChange, blocked, noArrival, minNights, nightly, months = 2, inline }: Props) {
  const [pick, setPick] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [month, setMonth] = useState(() => new Date(checkIn.getFullYear(), checkIn.getMonth(), 1));
  const t = today();
  const last = useMemo(() => new Date(t.getFullYear(), t.getMonth() + MONTHS_AHEAD, 1), [t]);

  const isBlocked = (d: Date) => !!blocked && blocked.has(key(d));
  const canArrive = (d: Date) => !(noArrival && noArrival.has(key(d)));
  const minFor = (d: Date) => (minNights && minNights[key(d)]) || 1;

  function crossesBlocked(x: Date, y: Date) {
    for (let d = new Date(x); d < y; d = addDays(d, 1)) if (isBlocked(d)) return true;
    return false;
  }
  // The first blocked night at or after `from`, as the latest possible checkout.
  function latestCheckout(from: Date) {
    let d = addDays(from, 1);
    while (!isBlocked(addDays(d, -1)) && d < addDays(last, 31)) d = addDays(d, 1);
    return d;
  }

  function tap(d: Date) {
    if (!pick) { setPick(d); return; }
    if (d <= pick) { setPick(d); return; }
    const okOut = d <= latestCheckout(pick);
    const okMin = (d.getTime() - pick.getTime()) / 864e5 >= minFor(pick);
    if (!okOut || !okMin) { setPick(d); return; }
    onChange(pick, d); setPick(null); setHover(null);
  }

  // Range being shown: a committed stay (only if it is still bookable), or an in progress pick with hover preview.
  const committedOk = !crossesBlocked(checkIn, checkOut);
  const a = pick || (committedOk ? checkIn : null);
  const b = pick ? (hover && hover > pick ? hover : null) : (committedOk ? checkOut : null);
  const maxOut = pick ? latestCheckout(pick) : null;
  const minOut = pick ? addDays(pick, minFor(pick)) : null;
  const canGoBack = month > new Date(t.getFullYear(), t.getMonth(), 1);
  const canGoFwd = new Date(month.getFullYear(), month.getMonth() + months, 1) <= last;

  const blocks = [];
  for (let k = 0; k < months; k++) {
    const m = new Date(month.getFullYear(), month.getMonth() + k, 1);
    const first = m.getDay(); const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(<span key={'e' + i} className="pad" />);
    for (let dd = 1; dd <= dim; dd++) {
      const dt = new Date(m.getFullYear(), m.getMonth(), dd); const k2 = key(dt);
      const past = dt < t;
      const blk = isBlocked(dt);
      const prevBlk = isBlocked(addDays(dt, -1));
      let cls = 'day'; let disabled = false; let title = '';

      if (past) { cls += ' past'; disabled = true; }
      else if (!pick) {
        // Choosing check in: a blocked night is out; a free night after a blocked one is checkout only.
        if (blk) { cls += ' booked'; disabled = true; title = 'Booked'; }
        else if (!canArrive(dt)) { cls += ' noarrive'; disabled = true; title = 'No check in on this day'; }
        else if (prevBlk && blk === false && isBlocked(dt)) { cls += ' booked'; disabled = true; }
      } else {
        // Choosing check out: anything before the pick restarts; after it, bounded by block and min stay.
        if (dt <= pick) { if (blk) { cls += ' booked'; disabled = true; } }
        else if (maxOut && dt > maxOut) { cls += ' unreach'; disabled = true; title = 'Booked before then'; }
        else if (minOut && dt < minOut) { cls += ' short'; disabled = true; title = `${minFor(pick)} night minimum`; }
        else if (blk && dt.getTime() === maxOut?.getTime()) { cls += ' outonly'; title = 'Checkout only'; }
      }
      if (!pick && !past && !blk && prevBlk) cls += ' outonly-hint';

      if (a && key(a) === k2) cls += ' start';
      if (b && key(b) === k2) cls += ' end';
      if (a && b && dt > a && dt < b) cls += ' in';
      if (pick && !b && key(pick) === k2) cls += ' start solo';

      const price = nightly && nightly[k2];
      cells.push(
        <button type="button" key={k2} className={cls} disabled={disabled} title={title}
          onClick={() => tap(dt)} onMouseEnter={() => pick && setHover(dt)} onFocus={() => pick && setHover(dt)}
          aria-label={dt.toDateString() + (title ? ', ' + title : '')}>
          <span className="n">{dd}</span>
          {price != null && !disabled && <span className="p">${Math.round(price)}</span>}
        </button>
      );
    }
    blocks.push(
      <div className="month" key={k} onMouseLeave={() => setHover(null)}>
        <div className="mh">
          {k === 0 ? <button type="button" disabled={!canGoBack} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button> : <span />}
          <span>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          {k === months - 1 ? <button type="button" disabled={!canGoFwd} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button> : <span />}
        </div>
        <div className="dow">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="days">{cells}</div>
      </div>
    );
  }

  const hint = pick
    ? (minFor(pick) > 1 ? `Select checkout. ${minFor(pick)} night minimum from ${pick.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.` : 'Select your checkout date.')
    : 'Select your check in date.';

  return (
    <div className={'cal open' + (inline ? ' inline' : '')} role="group" aria-label="Choose dates">
      <div className="calrow">{blocks}</div>
      <div className="calfoot">
        <span className="hint">{hint}</span>
        <span className="legend"><i className="k-booked" />Unavailable<i className="k-out" />Checkout only</span>
        {pick && <button type="button" className="clear" onClick={() => { setPick(null); setHover(null); }}>Clear</button>}
      </div>
    </div>
  );
}
