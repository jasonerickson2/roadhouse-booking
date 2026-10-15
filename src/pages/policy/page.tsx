import { Link } from 'react-router-dom';
import Footer from '../../components/feature/Footer';
import { policy, season } from '../../lib/booking';

const SUMMER = policy(new Date(2026, 6, 1));
const WINTER = policy(new Date(2026, 0, 15));

export default function PolicyPage() {
  const now = season(new Date());
  return (<>
    <main className="policy-page">
      <h1>Cancellation policy</h1>
      <p>The policy that applies is the one in effect on your check in date. It is shown again before you place a hold.</p>
      <h2>{SUMMER.label}{now === 'summer' && <span className="now">In effect now</span>}</h2>
      <ul>{SUMMER.rules.map(r => <li key={r}>{r}</li>)}</ul>
      <h2>{WINTER.label}{now === 'winter' && <span className="now">In effect now</span>}</h2>
      <ul>{WINTER.rules.map(r => <li key={r}>{r}</li>)}</ul>
      <h2>How to cancel</h2>
      <p>Use the cancel link in your confirmation text or email, or call 719 225 2364. Refunds go back to the card used for the hold.</p>
      <p style={{ marginTop: 28 }}><Link to="/">Back to booking</Link></p>
    </main>
    <Footer />
  </>);
}
