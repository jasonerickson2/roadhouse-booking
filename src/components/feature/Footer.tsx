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
            <strong>The Café</strong><br />Coffee, soft serve, breakfast.<br />Peak season daily, off season no set hours.<br />
            <a href="https://www.roadhousetwinlakes.com/about-5-1">Menu</a>
          </div>
          <div>
            <strong>Good to know</strong><br />
            <a href="#policy">Cancellation policy</a><br />
            <a href="https://www.roadhousetwinlakes.com/blank-2">House rules</a><br />
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
