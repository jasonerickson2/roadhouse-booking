import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, key, today } from '../../lib/booking';

interface ModalOpts {
  title: string;                          // "Select dates" or the room name
  cta: string;                            // "Show rooms" / "Save dates"
  priceFrom?: boolean;                    // true when prices are the lowest across rooms ("from $230")
  // guests is adults plus children (what must fit sleeps); infants do not count, at most 1.
  party?: { guests: number; pets: number; children?: number; infants?: number; minChildAge?: number; allowInfants?: boolean; maxGuests?: number; maxPets?: number; onChange: (guests: number, pets: number, children: number, infants: number) => void };
  onClose: () => void;
}

interface Props {
  checkIn: Date;
  checkOut: Date;
  onChange: (checkIn: Date, checkOut: Date) => void;
  blocked?: Set<string>;                  // nights that cannot be part of the stay
  noArrival?: Set<string>;                // dates that cannot be a check in
  minNights?: Record<string, number>;     // minimum stay when checking in on that date
  nightly?: Record<string, number>;       // price per night, shown in the cell when known (display only)
  months?: number;                        // months shown side by side (inline mode)
  inline?: boolean;
  modal?: ModalOpts;                      // Airbnb style panel on desktop, bottom sheet on phone
}

const MONTHS_AHEAD = 18;
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const short = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Two step range picker in the pattern guests know from Airbnb.
//   - past and booked nights are struck through (booked ones striped)
//   - after the first tap, nights that would break the minimum stay or cross a booking gray out
//   - in modal mode the range is a draft until the guest presses the button
export default function RangeCalendar({ checkIn, checkOut, onChange, blocked, noArrival, minNights, nightly, months = 2, inline, modal }: Props) {
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

  const committedOk = !crossesBlocked(checkIn, checkOut);
  const [pick, setPick] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [draft, setDraft] = useState<{ a: Date; b: Date } | null>(committedOk ? { a: checkIn, b: checkOut } : null);
  const [month, setMonth] = useState(() => {
    const base = committedOk && checkIn >= t ? checkIn : t;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const shown = modal ? 2 : months;
  const [adults, setAdults] = useState((modal?.party?.guests ?? 2) - (modal?.party?.children ?? 0));
  const [kids, setKids] = useState(modal?.party?.children ?? 0);
  const [infants, setInfants] = useState(modal?.party?.infants ?? 0);
  const maxG = modal?.party?.maxGuests ?? 8;
  const [pets, setPets] = useState(modal?.party?.pets ?? 0);

  // Modal: Escape closes, page behind does not scroll.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') modal.onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [modal]);

  function tap(d: Date) {
    if (!pick) { setPick(d); setDraft(null); return; }
    if (d <= pick) { setPick(d); return; }
    const okOut = d <= latestCheckout(pick);
    const okMin = Math.round((d.getTime() - pick.getTime()) / 864e5) >= minFor(pick);
    if (!okOut || !okMin) { setPick(d); return; }
    if (modal) { setDraft({ a: pick, b: d }); setPick(null); setHover(null); return; }
    onChange(pick, d); setPick(null); setHover(null);
  }

  // Range being shown: an in progress pick with hover preview, else the draft (modal) or the committed stay.
  const settled = modal ? draft : (committedOk ? { a: checkIn, b: checkOut } : null);
  const a = pick || settled?.a || null;
  const b = pick ? (hover && hover > pick ? hover : null) : settled?.b || null;
  const maxOut = pick ? latestCheckout(pick) : null;
  const minOut = pick ? addDays(pick, minFor(pick)) : null;
  const canGoBack = month > new Date(t.getFullYear(), t.getMonth(), 1);
  const canGoFwd = new Date(month.getFullYear(), month.getMonth() + shown, 1) <= last;

  // Cheapest price among the visible open nights gets a highlight (home page only).
  const visibleKeys: string[] = [];
  for (let k = 0; k < shown; k++) {
    const m = new Date(month.getFullYear(), month.getMonth() + k, 1);
    const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (let dd = 1; dd <= dim; dd++) { const dt = new Date(m.getFullYear(), m.getMonth(), dd); if (dt >= t && !isBlocked(dt)) visibleKeys.push(key(dt)); }
  }
  const visiblePrices = visibleKeys.map(k => nightly?.[k]).filter((p): p is number => !!p);
  const lowest = modal?.priceFrom && visiblePrices.length ? Math.min(...visiblePrices) : null;

  const blocks = [];
  for (let k = 0; k < shown; k++) {
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
        if (blk) { cls += ' booked'; disabled = true; title = 'Booked'; }
        else if (!canArrive(dt)) { cls += ' noarrive'; disabled = true; title = 'No check in on this day'; }
      } else {
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
      if (lowest && price === lowest && !disabled) cls += ' deal';
      cells.push(
        <button type="button" key={k2} className={cls} disabled={disabled} title={title}
          onClick={() => tap(dt)} onMouseEnter={() => pick && setHover(dt)} onFocus={() => pick && setHover(dt)}
          aria-label={dt.toDateString() + (title ? ', ' + title : '') + (price && !disabled ? `, ${money(price)}` : '')}>
          <span className="n">{dd}</span>
          {price != null && price > 0 && !disabled && !past && <span className="p">{money(price)}</span>}
        </button>
      );
    }
    blocks.push(
      <div className="month" key={k} onMouseLeave={() => setHover(null)}>
        <div className="mh">
          {k === 0 ? <button type="button" disabled={!canGoBack} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button> : <span />}
          <span>{m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          {k === shown - 1 ? <button type="button" disabled={!canGoFwd} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button> : <span />}
        </div>
        <div className="dow">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="days">{cells}</div>
      </div>
    );
  }

  const hint = pick
    ? (minFor(pick) > 1 ? `Select checkout. ${minFor(pick)} night minimum from ${pick.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.` : 'Select your checkout date.')
    : 'Select your check in date.';

  if (!modal) {
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

  // ---- modal: panel on desktop, bottom sheet on phone ----
  const nights = draft ? Math.round((draft.b.getTime() - draft.a.getTime()) / 864e5) : 0;
  let sum = 0; let priced = !!draft && !!nightly;
  if (draft && nightly) for (let d = new Date(draft.a); d < draft.b; d = addDays(d, 1)) { const p = nightly[key(d)]; if (!p) { priced = false; break; } sum += p; }
  const sub = draft ? `${short(draft.a)} to ${short(draft.b)} · ${nights} night${nights > 1 ? 's' : ''}` : hint;

  return createPortal(
    <div className="rc-modal" role="dialog" aria-modal="true" aria-label={modal.title}>
      <div className="rc-scrim" onClick={modal.onClose} />
      <div className="rc-panel">
        <div className="rc-grab" />
        <div className="rc-top">
          <div><h3>{modal.title}</h3><p>{sub}</p></div>
          <button type="button" className="rc-x" onClick={modal.onClose} aria-label="Close">✕</button>
        </div>
        <div className="calrow">{blocks}</div>
        {modal.party && (
          <div className="rc-party">
            <Stepper label="Adults" note="13 and up" value={adults} min={1} max={maxG - kids} onChange={setAdults} />
            <Stepper label="Children" note={`Ages ${modal.party.minChildAge ?? 2} to 12`} value={kids} min={0} max={maxG - adults} onChange={setKids} />
            {modal.party.allowInfants !== false && <Stepper label="Infants" note="Under 2" value={infants} min={0} max={1} onChange={setInfants} />}
            <Stepper label="Pets" value={pets} min={0} max={modal.party.maxPets ?? 2} onChange={setPets} />
          </div>
        )}
        <div className="rc-foot">
          <div className="rc-legend"><span><i className="k-booked" />Booked</span>{nightly && <span>{modal.priceFrom ? 'Lowest nightly rate' : 'Price per night'}</span>}</div>
          <div className="rc-sum">
            {draft && priced ? <><b>{modal.priceFrom ? 'from ' : ''}{money(sum)}</b><span>{nights} night{nights > 1 ? 's' : ''} before fees</span></>
              : <span>{draft ? `${nights} night${nights > 1 ? 's' : ''}` : 'Pick your dates'}</span>}
          </div>
          <div className="rc-btns">
            <button type="button" className="rc-clear" onClick={() => { setPick(null); setHover(null); setDraft(null); }}>Clear</button>
            <button type="button" className="rc-go" disabled={!draft} onClick={() => { if (draft) { modal.party?.onChange(adults + kids, pets, kids, modal.party?.allowInfants === false ? 0 : infants); onChange(draft.a, draft.b); modal.onClose(); } }}>{modal.cta}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Stepper({ label, note, value, min, max, onChange }: { label: string; note?: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="rc-step">
      <span>{label}{note && <small>{note}</small>}</span>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <b aria-live="polite">{value}</b>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
