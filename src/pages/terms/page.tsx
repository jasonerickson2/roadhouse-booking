import { Link } from 'react-router-dom';
import Footer from '../../components/feature/Footer';
import { EARLY_LABEL, LATE_LABEL, STAY_META, fmt, policy, season } from '../../lib/booking';

const SUMMER = policy(new Date(2026, 6, 1));
const WINTER = policy(new Date(2026, 0, 15));

// Booking terms. The checkout checkbox ("I agree to the booking terms") points here, so the card on file
// authorization below is what guests agree to. Wording of that section is the owner approved checkout text.
export default function TermsPage() {
  const now = season(new Date());
  const lodgePet = STAY_META.find(m => m.group === 'rooms')?.petFee;
  return (<>
    <main className="policy-page terms">
      <h1>Booking terms</h1>
      <p>These terms apply to stays booked on this site with Roadhouse Twin Lakes. By checking "I agree to the booking terms" at checkout you accept everything on this page.</p>

      <h2>Your hold</h2>
      <p>When you request a stay we place a hold on your card for the total shown. It is not charged until we confirm, usually within the hour. If we cannot confirm, the hold is released.</p>

      <h2>Card on file and incidentals</h2>
      <p>Your card is securely saved for this stay. You authorize Roadhouse Twin Lakes to charge this card for incidental fees (damage, extra cleaning, late checkout, unapproved pets or guests) per these booking terms.</p>

      <h2>Cancellation</h2>
      <p>The policy in effect on your check in date applies.</p>
      <h3>{SUMMER.label}{now === 'summer' && <span className="now">In effect now</span>}</h3>
      <ul>{SUMMER.rules.map(r => <li key={r}>{r}</li>)}</ul>
      <h3>{WINTER.label}{now === 'winter' && <span className="now">In effect now</span>}</h3>
      <ul>{WINTER.rules.map(r => <li key={r}>{r}</li>)}</ul>
      <p>Use the cancel link in your confirmation text or email, or call 719 225 2364. Refunds go back to the card used for the hold.</p>

      <h2>Check in and checkout</h2>
      <p>Check in 4:00 PM, checkout before 10:00 AM. Your door code comes by text at 4pm the day before. Early check in ({EARLY_LABEL}) and late checkout ({LATE_LABEL}) are offered as add ons at checkout when available.</p>

      <h2>Pets</h2>
      <p>Pets are welcome only where the room allows them and only when added at checkout, with a per stay pet fee{lodgePet ? ` (from ${fmt(lodgePet)})` : ''}. Unapproved pets are charged as an incidental.</p>

      <h2>House rules</h2>
      <p>No parties or events. No smoking. Each room's page lists its own house rules, and they are part of these terms.</p>

      <h2>Prices, taxes and fees</h2>
      <p>Totals include nightly rates, cleaning and a 2% card processing fee. Colorado state sales tax (2.9%), Lake County sales tax (4.0%) and lodging tax (1.9%) are added at checkout.</p>

      <h2 id="cookies">Cookies and follow ups</h2>
      <p>This site sets first party cookies to remember your search and booking. It also records which pages you visit, the dates and party size you search, your device type, how you found us, and your approximate area (state and city, not your exact address). If you start a booking and don't finish, we or a service provider working for us may match your visit to an email address so we can check in once or twice about your stay. Every email has an unsubscribe link.</p>
      <p>To opt out, tap "No thanks" on the notice at the top of the site, or turn on Global Privacy Control in your browser. Visitors in California are not tracked unless they choose "Okay." We do not sell this information.</p>

      <p style={{ marginTop: 28 }}><Link to="/">Back to booking</Link></p>
    </main>
    <Footer />
  </>);
}
