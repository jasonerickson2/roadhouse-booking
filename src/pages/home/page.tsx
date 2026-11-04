import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import Footer from '../../components/feature/Footer';
import RangeCalendar, { Stepper } from '../../components/base/RangeCalendar';
import AvailabilityGrid from '../../components/base/AvailabilityGrid';
import { useAvailability, useCalendars } from '../../hooks/useBookingData';
import { STAY_META, addDays, closedUntil, extrasTotal, fmt, key, minStay, nice, nightsBetween, partyLabel, readSearch, season, writeSearch, type SearchState, type StayMeta } from '../../lib/booking';
import type { RoomAvailability, RoomCalendar } from '../../services/availability';

// Paste real guest reviews here: { text: 'quote', who: 'First name · Room 1 · Month year' }
const REVIEWS: { text: string; who: string }[] = [
  { text: 'Loved it! Right in the heart of the beautiful, funky Twin Lakes village. Fascinating mining and tourist history. Shana was great, and the lodge is just as described. Simple, clean, and down to earth.', who: 'Jane · Room 1 · June 2026' },
  { text: "I truly can't overstate just how perfect and special this place is! The room itself was so cozy, clean, and beautiful, not to mention it's located in what has to be one of the most gorgeous towns in the entire country.", who: 'Carly · Penthouse · July 2026' },
  { text: "Lovely spot! The owners have an amazing coffee shop right there and it's a short walk to the general store and to the lake. Great views, communicative hosts.", who: 'Martin · Carriage House · September 2026' },
];

// Hero follows the season of the dates being searched (a June search shows summer).
const heroFor = (d: Date) => (season(d) === 'winter' ? '/img/hero-winter.jpg' : '/img/hero-summer.jpg');

type Status = 'fits' | 'booked' | 'guests' | 'infant' | 'min' | 'loading';

export function stayStatus(meta: StayMeta, s: SearchState, r: RoomAvailability | undefined, loading: boolean, cal?: RoomCalendar): Status {
  if (loading || !r) return 'loading';
  if (!r.isAvailable) return 'booked';
  // A Hostex block (seasonal close, owner hold) is not a reservation, so availability says open.
  // The calendar knows. Any blocked night inside the stay means this room is not bookable.
  if (cal && cal.blockedDates.size) {
    for (let d = new Date(s.checkIn); d < s.checkOut; d = addDays(d, 1)) if (cal.blockedDates.has(key(d))) return 'booked';
  }
  if (meta.sleeps < s.guests) return 'guests';
  if (s.infants > 0 && !meta.infants) return 'infant';
  if (nightsBetween(s.checkIn, s.checkOut) < minStay(meta, cal, s.checkIn)) return 'min';
  return 'fits';
}

export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = readSearch(params);
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const { rooms: avail, loading, error } = useAvailability(search);
  const { calendars, loading: calLoading } = useCalendars();
  const [calOpen, setCalOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const whoLabel = `${partyLabel(search)}${search.pets ? `, ${search.pets} pet${search.pets > 1 ? 's' : ''}` : ''}`;
  const calRef = useRef<HTMLFormElement>(null);
  // The picker reports guests and pets just before the dates; both go into one URL update.
  const partyRef = useRef<{ guests: number; pets: number; children: number; infants: number } | null>(null);
  // Results start with the availability calendar at the top of the screen, rooms right below it.
  const showResults = () => { const el = document.querySelector('.ag'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: 'smooth' }); };
  const [wide, setWide] = useState(() => window.innerWidth >= 700);
  // Nights no room can host: blocked on every calendar we have. Shown struck through in the search picker.
  const allBlocked = (() => {
    const cals = STAY_META.map(m => calendars[m.id]).filter((c): c is RoomCalendar => !!c);
    if (cals.length < STAY_META.length) return undefined;
    const out = new Set<string>();
    for (const k of cals[0].blockedDates) if (cals.every(c => c.blockedDates.has(k))) out.add(k);
    return out;
  })();

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 700);
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement)?.closest?.('.rc-modal')) return; if (calRef.current && !calRef.current.contains(e.target as Node)) { setCalOpen(false); setWhoOpen(false); } };
    window.addEventListener('resize', onResize); document.addEventListener('click', onClick);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('click', onClick); };
  }, []);

  const update = (patch: Partial<SearchState>) => setParams(writeSearch({ ...search, ...patch }), { replace: true });
  const byId = (id: number) => avail?.find(r => r.roomId === id);
  const roomMock = (id: number) => rooms.find(r => r.id === id)!;

  function cardTotal(meta: StayMeta) {
    const r = byId(meta.id); if (!r?.pricing) return 0;
    return r.pricing.totalAmount + extrasTotal(meta, { pets: search.pets, earlyHours: 0, late: false }).total;
  }
  const openCount = STAY_META.filter(m => stayStatus(m, search, byId(m.id), loading, calendars[m.id]) === 'fits').length;
  // Before taxes, with cleaning, pet and card processing in (FTC all in rule allows taxes to come later).
  function preTaxTotal(meta: StayMeta) {
    const r = byId(meta.id); if (!r?.pricing) return 0;
    return cardTotal(meta) - r.pricing.taxTotal - extrasTotal(meta, { pets: search.pets, earlyHours: 0, late: false }).tax;
  }
  const cheapest = Math.min(...STAY_META.filter(m => stayStatus(m, search, byId(m.id), loading, calendars[m.id]) === 'fits').map(preTaxTotal));

  function Card({ meta, wideCard }: { meta: StayMeta; wideCard?: boolean }) {
    const mock = roomMock(meta.id); const st = stayStatus(meta, search, byId(meta.id), loading, calendars[meta.id]); const total = cardTotal(meta);
    const r = byId(meta.id); const nightly = r?.pricing?.nightlyPrices?.length ? Math.min(...r.pricing.nightlyPrices) : mock.price;
    // FTC all in rule: the most prominent price is the total with every mandatory fee (cleaning, pet, card processing); taxes may come later.
    const preTax = preTaxTotal(meta);
    const avgNight = r?.pricing?.nightlyPrices?.length ? r.pricing.baseRate / r.pricing.nightlyPrices.length : nightly;
    const bedsText = mock.bedTypes.length > 2 ? `${mock.beds} beds` : mock.bedTypes.map(b => b.beds).join(', ');
    const spec = `Sleeps ${meta.sleeps} · ${bedsText} · ${mock.bathrooms} bath${meta.season ? ' · ' + meta.season : ''}`;
    let line: React.ReactNode, badge: React.ReactNode = meta.tag ? <span className="badge">{meta.tag}</span> : null;
    if (st === 'loading') line = <span className="spec">Checking price…</span>;
    else if (st === 'fits') line = <><span className="price"><b>{fmt(preTax)}</b> <span className="spec">total before taxes</span><br /><span className="spec sub">{fmt(avgNight)} avg a night · {nights} night{nights > 1 ? 's' : ''} · includes cleaning{search.pets > 0 ? ' and pet fee' : ''}</span></span><span className="ok">Open for your dates</span></>;
    else if (st === 'booked') { badge = <span className="badge gray">Booked for these dates</span>; line = <><span className="price"><span className="spec">from</span> <b>{fmt(nightly)}</b> <span className="spec">a night</span></span><span className="no">Tap to see open dates</span></>; }
    else if (st === 'guests') { badge = <span className="badge gray">Too small for {search.guests} guests</span>; line = <><span className="price"><span className="spec">Sleeps up to {meta.sleeps}</span></span><span className="no">Change guests to book this room</span></>; }
    else if (st === 'infant') { badge = <span className="badge gray">No infants</span>; line = <><span className="price"><span className="spec">Children {meta.minChildAge} and up, shared walls</span></span><span className="no">Try the Carriage House or Grizzly Maze</span></>; }
    else { const mn = minStay(meta, calendars[meta.id], search.checkIn); line = <><span className="price"><b>{fmt(nightly)}</b> <span className="spec">a night, {mn} night minimum</span></span><span className="no">{mn} night minimum from {nice(search.checkIn)}</span></>; }
    // Long Hostex block = closed for the season: say when it opens and link straight to that date.
    let to = `/room/${meta.id}?${writeSearch(search)}`;
    const reopen = st === 'booked' ? closedUntil(calendars[meta.id], search.checkIn) : null;
    if (reopen) {
      const out = addDays(reopen, minStay(meta, calendars[meta.id], reopen));
      badge = <span className="badge gray">Closed for the season</span>;
      line = <><span className="price"><span className="spec">Opens {nice(reopen)}</span></span><span className="no">Book from {reopen.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>;
      to = `/room/${meta.id}?${writeSearch({ ...search, checkIn: reopen, checkOut: out })}`;
    }
    return (
      <Link className={'card' + (st === 'booked' || st === 'guests' || st === 'infant' ? ' booked' : '')} to={to} style={wideCard ? { gridColumn: '1 / -1', maxWidth: 720, width: '100%', margin: '0 auto' } : undefined}>
        <img src={mock.image} alt={meta.short} loading="lazy" />{badge}
        <div className="body">
          <div className="row"><span className="name">{meta.short}</span><span className="rating"><b>★</b> {mock.rating.toFixed(2)} · {mock.reviews} reviews</span></div>
          <span className="spec">{spec}</span>{line}
        </div>
      </Link>
    );
  }

  const roomsMeta = STAY_META.filter(m => m.group === 'rooms'), suitesMeta = STAY_META.filter(m => m.group === 'suites'), house = STAY_META.find(m => m.group === 'house')!;

  return (
    <>
      <section className="hero" id="top">
        <img src={heroFor(search.checkIn)} alt="Twin Lakes below Mount Elbert" /><div className="shade" />
        <div className="txt">
          <span className="eyebrow">Twin Lakes, Colorado</span>
          <h1>Colorado's largest glacial lakes. Its tallest peak. One lodge between them.</h1>
          <p>Rooms in Twin Lakes village at the foot of Mount Elbert and Independence Pass. Café on site. Lowest rate when you book direct.</p>
        </div>
      </section>

      <section className="wrap" id="search">
        <form className="searchbox" ref={calRef} onSubmit={e => { e.preventDefault(); showResults(); }}>
          <div className="field"><span>Check in</span><button type="button" className="date" onClick={() => setCalOpen(o => !o)}>{nice(search.checkIn)}</button></div>
          <div className="field"><span>Check out</span><button type="button" className="date" onClick={() => setCalOpen(o => !o)}>{nice(search.checkOut)}</button></div>
          {/* One "Who's coming" field (Airbnb pattern) for adults, children, infants and pets. */}
          <div className="field who"><span>Who's coming</span><button type="button" className="date" aria-expanded={whoOpen} onClick={() => { setWhoOpen(o => !o); setCalOpen(false); }}>{whoLabel}</button>
            {whoOpen && (
              <div className="who-pop">
                <Stepper label="Adults" note="13 and up" value={search.guests - search.children} min={1} max={8 - search.children} onChange={n => update({ guests: n + search.children })} />
                <Stepper label="Children" note="Ages 2 to 12 (5 and up in lodge rooms)" value={search.children} min={0} max={8 - (search.guests - search.children)} onChange={n => update({ guests: search.guests - search.children + n, children: n })} />
                <Stepper label="Infants" note="Under 2, Carriage House and Grizzly only" value={search.infants} min={0} max={1} onChange={n => update({ infants: n })} />
                <Stepper label="Pets" value={search.pets} min={0} max={2} onChange={n => update({ pets: n })} />
                <button type="button" className="btn who-done" onClick={() => setWhoOpen(false)}>Done</button>
              </div>
            )}</div>
          <button className="btn go" type="submit">Show prices</button>
          {calOpen && <RangeCalendar checkIn={search.checkIn} checkOut={search.checkOut} blocked={allBlocked} modal={{ title: 'Select dates', cta: 'Show rooms', party: { guests: search.guests, pets: search.pets, children: search.children, infants: search.infants, onChange: (g, p, c, i) => { partyRef.current = { guests: g, pets: p, children: c, infants: i }; } }, onClose: () => setCalOpen(false) }} onChange={(a, b) => { update({ checkIn: a, checkOut: b, ...(partyRef.current || {}) }); partyRef.current = null; setTimeout(showResults, 50); }} />}
        </form>
        <AvailabilityGrid calendars={calendars} checkIn={search.checkIn} checkOut={search.checkOut} loading={calLoading} guests={search.guests} infants={search.infants} onPick={(id, d) => { const m = STAY_META.find(x => x.id === id)!; navigate(`/room/${id}?${writeSearch({ ...search, checkIn: d, checkOut: addDays(d, minStay(m, calendars[id], d)) })}`); }} />
      </section>

      <section className="wrap"><div className="trust">
        <div><strong>Owner operated</strong><span>Lowest rate direct, no platform fees.</span></div>
        <div><strong>Café on site</strong><span>Summer Wed to Sun. Free lobby coffee year round.</span></div>
        <div><strong>Self check in</strong><span>Door code by text at 4pm the day before.</span></div>
      </div></section>

      <section className="wrap sec" id="stays">
        <h2>At the lodge</h2>
        <div className="center" id="results-head" style={{ fontSize: 14 }}>
          {error ? <span className="no">Could not load live prices. {error}</span> : loading ? 'Checking prices…' : <><b>{openCount} of 6 open</b> · {nice(search.checkIn)} to {nice(search.checkOut)} · {nights} night{nights > 1 ? 's' : ''} · {search.guests} guest{search.guests > 1 ? 's' : ''}{search.pets ? ` · ${search.pets} pet${search.pets > 1 ? 's' : ''}` : ''}</>}
        </div>
        <div className="sub" style={{ marginTop: 6 }}>Rooms</div>
        <div className="cards">{roomsMeta.map(m => <Card key={m.id} meta={m} />)}</div>
        <div className="sub" style={{ marginTop: 14 }}>Penthouse and Carriage House, with kitchens</div>
        <div className="cards two">{suitesMeta.map(m => <Card key={m.id} meta={m} />)}</div>
      </section>

      <section className="wrap sec" id="groups">
        <h2>Bringing a group?</h2><div className="sub">The whole house, ten minutes up the mountain</div>
        <div className="cards two" style={{ gridTemplateColumns: '1fr' }}><Card meta={house} wideCard /></div>
      </section>

      <section className="wrap sec" id="reviews">
        <h2>{(rooms.reduce((a, r) => a + r.rating * r.reviews, 0) / rooms.reduce((a, r) => a + r.reviews, 0)).toFixed(2)} stars from {rooms.reduce((a, r) => a + r.reviews, 0)} guests</h2>
        <div className="sub">Reviews on Airbnb and Booking.com. Carriage House holds a 5.0, Room 1 and the Grizzly Maze sit at 4.98.</div>
        {REVIEWS.length > 0 && <div className="cards">{REVIEWS.map(r => <blockquote key={r.who} className="review" style={{ margin: 0 }}><span className="stars">★★★★★</span><span>{r.text}</span><cite>{r.who}</cite></blockquote>)}</div>}
      </section>

      <section className="wrap sec" id="location">
        <h2>Lake across the road, Mount Elbert out back</h2>
        <div className="loc">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0 }}>6411 Highway 82, Twin Lakes. Independence Pass starts here.</p>
            <div className="drive"><span>Leadville · 20 min</span><span>Ski Cooper · 30 min</span><span>Buena Vista · 25 min</span><span>Copper · 50 min</span><span>Aspen, summer · 1 hr</span><span>Vail, Breck, Keystone · 1 hr 15</span><span>Denver · 2 hr 15</span><span>Monarch · 1 hr 10</span></div>
          </div>
          <iframe title="Map to Roadhouse Twin Lakes" src="https://www.google.com/maps?q=6411+Highway+82,+Twin+Lakes,+CO+81251&output=embed" style={{ width: '100%', minHeight: 300, border: 0, borderRadius: 16 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        </div>
      </section>
      <Footer />
      <div className="sticky">
        {isFinite(cheapest) ? <><div className="l"><b>from {fmt(cheapest)}</b><span>{nights} night{nights > 1 ? 's' : ''}, before taxes</span></div><a className="btn" href="#stays">See rooms</a></>
          : <><div className="l"><b>{loading ? 'Checking…' : 'Nothing open'}</b><span>{nice(search.checkIn)}</span></div><a className="btn" href="#search" onClick={() => navigate('#search')}>Change dates</a></>}
      </div>
    </>
  );
}
