import { Link } from 'react-router-dom';
export default function Footer() {
  return (
    <footer id="contact">
      <div className="wrap">
        <div className="cols">
          <div>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: '#fff' }}>Roadhouse Twin Lakes</span><br />
            6411 Highway 82<br />Twin Lakes, CO 81251<br />License 2026-p12
          </div>
          <div>
            <strong>Contact</strong><br />
            <a href="tel:+17192252364">719 225 2364</a><br />
            <a href="https://www.roadhousetwinlakes.com/about-5">Email us</a><br />
            <a href="https://www.instagram.com/roadhousetwinlakes" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
          <div>
            <strong>The Café</strong><br />Coffee, soft serve, breakfast<br />Summer only<br />Wed, Thu 8 to 2 · Fri to Sun 8 to 4<br />
            <a href="https://www.roadhousetwinlakes.com/about-5-1">Menu</a>
          </div>
          <div>
            <strong>Good to know</strong><br />
            <Link to="/cancellation-policy">Cancellation policy</Link><br />
            <a href="https://www.roadhousetwinlakes.com/blank-2">About us</a><br />
            <a href="https://www.roadhousetwinlakes.com/about-3">Our recs</a>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} Roadhouse Twin Lakes. Owner operated.</span>
          <span>Payments by Square. Apple Pay, Google Pay, Cash App Pay and cards.</span>
        </div>
      </div>
    </footer>
  );
}
