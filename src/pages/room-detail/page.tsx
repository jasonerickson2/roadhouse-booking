import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { rooms } from '../../mocks/rooms';
import Footer from '../../components/feature/Footer';
import RangeCalendar from '../../components/base/RangeCalendar';
import { useAvailability, useCalendars } from '../../hooks/useBookingData';
import { addDays, extrasTotal, fmt, key, metaById, nice, nightsBetween, policy, readSearch, writeSearch, type Extras, type SearchState } from '../../lib/booking';
import { stayStatus } from '../home/page';

export default function RoomDetailPage() {
  const { id } = useParams();
  const roomId = parseInt(id || '0');
  const meta = metaById(roomId);
  const mock = rooms.find(r => r.id === roomId);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = readSearch(params);
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const { rooms: avail, loading, error } = useAvailability(search);
  const { calendars } = useCalendars([roomId]);
  const cal = calendars[roomId];
  const [showCal, setShowCal] = useState(false);
  const [moreDesc, setMoreDesc] = useState(false);
  const [allAms, setAllAms] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 700);
  const earlyHours = (parseInt(params.get('early') || '0') || 0) as 0 | 1 | 2;
  const late = params.get('late') === '1';
  useEffect(() => { const f = () => setWide(window.innerWidth >= 700); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  if (!meta || !mock) return <div className="wrap" style={{ padding: 40 }}><p>Room not found.</p><Link to="/">All rooms</Link></div>;

  const r = avail?.find(x => x.roomId === roomId);
  const st = stayStatus(meta, search, r, loading);
  const update = (patch: Partial<SearchState>, extra: Record<string, string> = {}) => setParams(writeSearch({ ...search, ...patch }, { early: String(earlyHours), late: late ? '1' : '0', ...extra }), { replace: true });
  const setExtra = (e: Partial<Extras>) => update({}, { early: String(e.earlyHours ?? earlyHours), late: (e.late ?? late) ? '1' : '0' });

  // Early check in needs the room empty the night before; late checkout needs no arrival the checkout night.
  const earlyAllowed = !!cal && addDays(search.checkIn, -1) >= new Date(new Date().setHours(0, 0, 0, 0)) && !cal.blockedDates.has(key(addDays(search.checkIn, -1)));
  const lateAllowed = !!cal && !cal.blockedDates.has(key(search.checkOut));
  const x: Extras = { pets: search.pets, earlyHours: earlyAllowed ? earlyHours : 0, late: lateAllowed && late };
  const ex = extrasTotal(meta, x);
  const p = r?.pricing;
  const total = (p?.totalAmount || 0) + ex.total;
  const pol = policy(search.checkIn);
  const paras = mock.longDescription.split('\n').map(s => s.trim()).filter(Boolean).filter(s => !s.startsWith('License') && !s.startsWith('Check out @') && !s.startsWith('**'));
  const rules = mock.houseRules.map(h => h.rule).filter(rl => !/Pets|Check/i.test(rl));
  const reserveTo = `/booking-flow?roomId=${roomId}&${writeSearch(search, { early: String(x.earlyHours), late: x.late ? '1' : '0' })}`;

  const priceBox = (
    <div className="pbox">
      {st === 'fits' ? <>
        <div className="dates">
          <div className="field"><span>Check in</span><button type="button" className="date" onClick={() => setShowCal(s => !s)}>{nice(search.checkIn)}</button></div>
          <div className="field"><span>Check out</span><button type="button" className="date" onClick={() => setShowCal(s => !s)}>{nice(search.checkOut)}</button></div>
        </div>
        {showCal && <RangeCalendar inline checkIn={search.checkIn} checkOut={search.checkOut} months={1} blocked={cal?.blockedDates} noArrival={cal?.noArrivalDates} onChange={(a, b) => { update({ checkIn: a, checkOut: b }); setShowCal(false); }} />}
        <div className="line"><span>{fmt((p?.baseRate || 0) / Math.max(1, nights))} × {nights} night{nights > 1 ? 's' : ''}</span><span>{fmt(p?.baseRate || 0)}</span></div>
        <div className="line"><span>Cleaning</span><span>{fmt(p?.cleaningFee || 0)}</span></div>
        {ex.pet > 0 && <div className="line"><span>Pet fee, per stay</span><span>{fmt(ex.pet)}</span></div>}
        {(earlyAllowed || lateAllowed) && <div className="fine" style={{ marginTop: 4 }}>Add ons for this stay</div>}
        {earlyAllowed && <div className="addon"><label><input type="checkbox" checked={x.earlyHours > 0} onChange={e => setExtra({ earlyHours: e.target.checked ? 2 : 0 })} /><span>Early check in<small>{fmt(meta.earlyFeePerHour)} an hour, up to 2 hours</small></span></label>
          <select disabled={x.earlyHours === 0} value={x.earlyHours || 2} onChange={e => setExtra({ earlyHours: parseInt(e.target.value) as 1 | 2 })} style={{ height: 36, border: '1px solid var(--line)', borderRadius: 8, font: 'inherit', background: '#fff' }}><option value={1}>3pm</option><option value={2}>2pm</option></select></div>}
        {lateAllowed && <div className="addon"><label><input type="checkbox" checked={x.late} onChange={e => setExtra({ late: e.target.checked })} /><span>Late checkout, 11am<small>{fmt(meta.lateFeePerHour)}, 1 hour</small></span></label><b>{fmt(meta.lateFeePerHour)}</b></div>}
        {ex.early > 0 && <div className="line"><span>Early check in, {x.earlyHours === 2 ? '2pm' : '3pm'}</span><span>{fmt(ex.early)}</span></div>}
        {ex.late > 0 && <div className="line"><span>Late checkout, 11am</span><span>{fmt(ex.late)}</span></div>}
        <div className="line"><span>Taxes (8.8%) and processing (2%)</span><span>{fmt((p?.taxes || []).reduce((a, t) => a + t.amount, 0) + (p?.serviceFee || 0) + ex.tax + ex.fee)}</span></div>
        <div className="tot"><span>Total</span><span>{fmt(total)}</span></div>
        <Link className="btn btn-wood" to={reserveTo} style={{ width: '100%' }}>Reserve</Link>
        <span className="fine center">Card held, not charged, until we confirm. Usually within the hour.</span>
      </> : <>
        <div className="note"><b>{st === 'loading' ? 'Checking availability…' : st === 'booked' ? `Booked ${nice(search.checkIn)} to ${nice(search.checkOut)}.` : st === 'guests' ? `Sleeps up to ${meta.sleeps}.` : `${meta.minNights} night minimum.`}</b> {st === 'booked' ? 'Pick open dates below, dark nights are taken.' : st === 'loading' ? '' : 'Change your search to see a price.'}{error ? ` ${error}` : ''}</div>
        <div className="dates">
          <div className="field"><span>Check in</span><button type="button" className="date" onClick={() => setShowCal(s => !s)}>{nice(search.checkIn)}</button></div>
          <div className="field"><span>Check out</span><button type="button" className="date" onClick={() => setShowCal(s => !s)}>{nice(search.checkOut)}</button></div>
        </div>
        {(showCal || st === 'booked') && <RangeCalendar inline checkIn={search.checkIn} checkOut={search.checkOut} months={1} blocked={cal?.blockedDates} noArrival={cal?.noArrivalDates} onChange={(a, b) => { update({ checkIn: a, checkOut: b }); setShowCal(false); }} />}
        {st === 'guests' && <div className="field"><label htmlFor="g2">Guests</label><select id="g2" value={search.guests} onChange={e => update({ guests: parseInt(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}</select></div>}
      </>}
    </div>
  );

  return (
    <>
      <div className="wrap">
        <Link className="back" to={`/?${writeSearch(search)}`}>‹ All rooms</Link>
        <div style={{ position: 'relative' }}><div className="carousel">{mock.gallery.slice(0, 8).map((u, i) => <img key={u} src={u} alt={`${meta.short} photo ${i + 1}`} loading="lazy" />)}</div></div>
        <div className="pgrid"><img className="big" src={mock.gallery[0]} alt={meta.short} />{mock.gallery.slice(1, 5).map((u, i) => <img key={u} src={u} alt={`${meta.short} photo ${i + 2}`} />)}</div>
        <div className="room">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div><h1>{meta.short}</h1><div className="specs" style={{ marginTop: 6 }}><span><b style={{ color: 'var(--brass)' }}>★</b> {mock.rating.toFixed(2)} ({mock.reviews} reviews)</span><span>{meta.kind}</span><span>Sleeps {meta.sleeps}</span><span>{mock.bedrooms} bedroom{mock.bedrooms > 1 ? 's' : ''}</span><span>{mock.bathrooms} bath</span></div></div>
            <div className="hl">{mock.highlights.map(h => <div key={h.title}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#265642" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg><span><b>{h.title}</b>{h.description}</span></div>)}</div>
            <div className="rule"><div className={'desc' + (moreDesc ? '' : ' clamp')}>{paras.map((t, i) => <p key={i} style={{ margin: '0 0 10px' }}>{t.replace(/^• /, '· ')}</p>)}</div><button className="more" type="button" onClick={() => setMoreDesc(m => !m)}>{moreDesc ? 'Show less' : 'Show more'}</button></div>
            <div className="rule"><h3>What you get</h3><div className="ams">{(allAms ? mock.amenities : mock.amenities.slice(0, 6)).map(a => <span key={a}>{a}</span>)}</div>{mock.amenities.length > 6 && !allAms && <button className="more" type="button" onClick={() => setAllAms(true)}>Show all {mock.amenities.length}</button>}</div>
            <div className="rule"><h3>Where you sleep</h3><ul className="list">{mock.bedTypes.map(b => <li key={b.bedroom}>{b.bedroom}: {b.beds}</li>)}</ul></div>
            <div className="rule"><h3>Good to know</h3><ul className="list"><li>Self check in. Door code by text at 4pm the day before.</li><li>In from 4pm, out by 10am. Early and late add ons when the room is free.</li><li>Pets welcome, {fmt(meta.petFee)} per stay, up to {meta.maxPets}.</li>{rules.map(rl => <li key={rl}>{rl}</li>)}</ul></div>
            <div className="rule" id="policy"><h3>Cancellation</h3><p style={{ margin: 0, fontSize: 14 }}>{pol.rules.slice(0, 3).join('. ')}. Full terms shown before you reserve.</p></div>
          </div>
          {wide && <div className="pcol">{priceBox}</div>}
        </div>
        {!wide && <div style={{ marginTop: 8, marginBottom: 32 }} id="pbox-mobile">{priceBox}</div>}
      </div>
      <Footer />
      <div className="sticky room-bar">
        {st === 'fits' ? <><div className="l"><b>{fmt(total)}</b><span>{nights} night{nights > 1 ? 's' : ''}, all in</span></div><button className="btn btn-wood" onClick={() => navigate(reserveTo)}>Reserve</button></>
          : <><div className="l"><b>{st === 'booked' ? 'Booked' : st === 'loading' ? 'Checking…' : 'Not available'}</b><span>{nice(search.checkIn)} to {nice(search.checkOut)}</span></div><a className="btn btn-line" href="#pbox-mobile">Open dates</a></>}
      </div>
    </>
  );
}
