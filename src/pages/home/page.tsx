import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import Footer from '../../components/feature/Footer';
import RangeCalendar from '../../components/base/RangeCalendar';
import AvailabilityGrid from '../../components/base/AvailabilityGrid';
import { useAvailability, useCalendars } from '../../hooks/useBookingData';
import { STAY_META, extrasTotal, fmt, nice, nightsBetween, readSearch, writeSearch, type SearchState, type StayMeta } from '../../lib/booking';
import type { RoomAvailability } from '../../services/availability';

const HERO = 'https://static.readdy.ai/image/2d0d20f832106674f714e5a5c924f53b/325666414111d5bf848a4c9ea0d70fd7.jpeg';

type Status = 'fits' | 'booked' | 'guests' | 'min' | 'loading';

export function stayStatus(meta: StayMeta, s: SearchState, r: RoomAvailability | undefined, loading: boolean): Status {
  if (loading || !r) return 'loading';
  if (!r.isAvailable) return 'booked';
  if (meta.sleeps < s.guests) return 'guests';
  if (nightsBetween(s.checkIn, s.checkOut) < meta.minNights) return 'min';
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
  const calRef = useRef<HTMLFormElement>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 700);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 700);
    const onClick = (e: MouseEvent) => { if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false); };
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
  const openCount = STAY_META.filter(m => stayStatus(m, search, byId(m.id), loading) === 'fits').length;
  const cheapest = Math.min(...STAY_META.filter(m => stayStatus(m, search, byId(m.id), loading) === 'fits').map(cardTotal));

  function Card({ meta, wideCard }: { meta: StayMeta; wideCard?: boolean }) {
    const mock = roomMock(meta.id); const st = stayStatus(meta, search, byId(meta.id), loading); const total = cardTotal(meta);
    const r = byId(meta.id); const nightly = r?.pricing?.nightlyPrices?.length ? Math.min(...r.pricing.nightlyPrices) : mock.price;
    const spec = `Sleeps ${meta.sleeps} · ${mock.bedTypes.map(b => b.beds).join(', ')} · ${mock.bathrooms} bath${meta.season ? ' · ' + meta.season : ''}`;
    let line: React.ReactNode, badge: React.ReactNode = meta.tag ? <span className="badge">{meta.tag}</span> : null;
    if (st === 'loading') line = <span className="spec">Checking price…</span>;
    else if (st === 'fits') line = <><span className="price"><b>{fmt(total)}</b> <span className="spec">total, {nights} night{nights > 1 ? 's' : ''}, fees and tax in</span></span><span className="ok">Open for your dates</span></>;
    else if (st === 'booked') { badge = <span className="badge gray">Booked for these dates</span>; line = <><span className="price"><b>{fmt(nightly)}</b> <span className="spec">a night</span></span><span className="no">Tap to see open dates</span></>; }
    else line = <><span className="price"><b>{fmt(nightly)}</b> <span className="spec">a night{meta.minNights > 1 ? `, ${meta.minNights} night minimum` : ''}</span></span><span className="no">{st === 'guests' ? `Sleeps up to ${meta.sleeps}` : `${meta.minNights} night minimum`}</span></>;
    return (
      <Link className={'card' + (st === 'booked' ? ' booked' : '')} to={`/room/${meta.id}?${writeSearch(search)}`} style={wideCard ? { gridColumn: '1 / -1', maxWidth: 720, width: '100%', margin: '0 auto' } : undefined}>
        <img src={mock.image} alt={meta.short} loading="lazy" />{badge}
        <div className="body">
          <div className="row"><span className="name">{meta.short}</span><span className="rating"><b>★</b> {mock.rating.toFixed(2)} · {mock.reviews}</span></div>
          <span className="spec">{spec}</span>{line}
        </div>
      </Link>
    );
  }

  const roomsMeta = STAY_META.filter(m => m.group === 'rooms'), suitesMeta = STAY_META.filter(m => m.group === 'suites'), house = STAY_META.find(m => m.group === 'house')!;

  return (
    <>
      <section className="hero" id="top">
        <img src={HERO} alt="Twin Lakes under the Collegiate Peaks" /><div className="shade" />
        <div className="txt">
          <span className="eyebrow">Twin Lakes, Colorado</span>
          <h1>A small lodge with the lake across the road.</h1>
          <p>Three rooms, a penthouse and a carriage house above our café, plus a cabin ten minutes up the mountain for groups. Lowest rate when you book direct.</p>
        </div>
      </section>

      <section className="wrap" id="search">
        <form className="searchbox" ref={calRef} onSubmit={e => { e.preventDefault(); document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <div className="field"><span>Check in</span><button type="button" className="date" onClick={() => setCalOpen(o => !o)}>{nice(search.checkIn)}</button></div>
          <div className="field"><span>Check out</span><button type="button" className="date" onClick={() => setCalOpen(o => !o)}>{nice(search.checkOut)}</button></div>
          <div className="field"><label htmlFor="guests">Guests</label>
            <select id="guests" value={search.guests} onChange={e => update({ guests: parseInt(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}</select></div>
          <div className="field"><label htmlFor="pets">Pets</label>
            <select id="pets" value={search.pets} onChange={e => update({ pets: parseInt(e.target.value) })}><option value={0}>No pets</option><option value={1}>1 pet</option><option value={2}>2 pets</option></select></div>
          <button className="btn go" type="submit">Show prices</button>
          {calOpen && <RangeCalendar checkIn={search.checkIn} checkOut={search.checkOut} months={wide ? 2 : 1} onChange={(a, b) => { update({ checkIn: a, checkOut: b }); setCalOpen(false); }} />}
        </form>
        <AvailabilityGrid calendars={calendars} checkIn={search.checkIn} checkOut={search.checkOut} loading={calLoading} />
      </section>

      <section className="wrap"><div className="trust">
        <div><strong>Owner operated</strong><span>Lowest rate when you book direct. No platform fees.</span></div>
        <div><strong>Coffee shop downstairs</strong><span>Open peak season. Off season hours are loose, but the lobby always has free coffee.</span></div>
        <div><strong>Self check in</strong><span>Door code arrives at 4pm the day before check in. In from 4pm, out by 10am.</span></div>
      </div></section>

      <section className="wrap sec" id="stays">
        <span className="eyebrow">Twin Lakes village</span><h2>At the lodge</h2>
        <div className="center" id="results-head" style={{ fontSize: 14 }}>
          {error ? <span className="no">Could not load live prices. {error}</span> : loading ? 'Checking prices…' : <><b>{openCount} of 6 open</b> · {nice(search.checkIn)} to {nice(search.checkOut)} · {nights} night{nights > 1 ? 's' : ''} · {search.guests} guest{search.guests > 1 ? 's' : ''}{search.pets ? ` · ${search.pets} pet${search.pets > 1 ? 's' : ''}` : ''}</>}
        </div>
        <div className="sub" style={{ marginTop: 6 }}>Rooms · private bath and entrance, lake across the road</div>
        <div className="cards">{roomsMeta.map(m => <Card key={m.id} meta={m} />)}</div>
        <div className="sub" style={{ marginTop: 14 }}>Penthouse and Carriage House · your own kitchen and living space, same building and yard</div>
        <div className="cards two">{suitesMeta.map(m => <Card key={m.id} meta={m} />)}</div>
      </section>

      <section className="wrap sec" id="groups">
        <span className="eyebrow">Bringing a group?</span><h2>The whole house, ten minutes up the mountain</h2>
        <div className="cards two" style={{ gridTemplateColumns: '1fr' }}><Card meta={house} wideCard /></div>
      </section>

      <section className="wrap sec" id="reviews">
        <span className="eyebrow">From recent guests</span><h2>What people say</h2>
        <div className="cards">
          <blockquote className="review" style={{ margin: 0 }}><span className="stars">★★★★★</span><span>[PASTE A REAL REVIEW FOR ROOM 1]</span><cite>[Guest first name] · Room 1 · [Month year]</cite></blockquote>
          <blockquote className="review" style={{ margin: 0 }}><span className="stars">★★★★★</span><span>[PASTE A REAL REVIEW FOR THE PENTHOUSE]</span><cite>[Guest first name] · Penthouse · [Month year]</cite></blockquote>
          <blockquote className="review" style={{ margin: 0 }}><span className="stars">★★★★★</span><span>[PASTE A REAL REVIEW FOR THE CARRIAGE HOUSE]</span><cite>[Guest first name] · Carriage House · [Month year]</cite></blockquote>
        </div>
      </section>

      <section className="wrap sec" id="location">
        <span className="eyebrow">Where you are</span><h2>Lake across the road, Mount Elbert out back</h2>
        <div className="loc">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0 }}>The lodge sits on Highway 82 with Twin Lakes across the road. Independence Pass starts here. Aspen is an hour over the top in summer, six ski areas are inside ninety minutes in winter.</p>
            <div className="drive"><span>Leadville · 20 min</span><span>Ski Cooper · 30 min</span><span>Buena Vista · 25 min</span><span>Copper · 50 min</span><span>Aspen, summer · 1 hr</span><span>Vail, Breck, Keystone · 1 hr 15</span><span>Denver · 2 hr 15</span><span>Monarch · 1 hr 10</span></div>
            <span className="fine">Winter: the highway is plowed. 4WD or AWD with good tread recommended December to April.</span>
          </div>
          <div className="mapbox">[MAP EMBED: Roadhouse Twin Lakes, Hwy 82]</div>
        </div>
      </section>
      <Footer />
      <div className="sticky">
        {isFinite(cheapest) ? <><div className="l"><b>from {fmt(cheapest)}</b><span>{nights} night{nights > 1 ? 's' : ''}, all in</span></div><a className="btn" href="#stays">See rooms</a></>
          : <><div className="l"><b>{loading ? 'Checking…' : 'Nothing open'}</b><span>{nice(search.checkIn)}</span></div><a className="btn" href="#search" onClick={() => navigate('#search')}>Change dates</a></>}
      </div>
    </>
  );
}
