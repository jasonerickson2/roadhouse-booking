
export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#E8DDD3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center space-y-4">
          {/* Social Links */}
          <div className="flex items-center space-x-4">
            <a
              href="https://www.instagram.com/roadhousetwinlakes"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: '#1a2e1a' }}
              aria-label="Instagram"
            >
              <img
                src="https://static.wixstatic.com/media/01c3aff52f2a4dffa526d7a9843d46ea.png/v1/fill/w_20,h_20,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/01c3aff52f2a4dffa526d7a9843d46ea.png"
                alt="Instagram"
                className="w-5 h-5"
              />
            </a>
          </div>

          {/* Contact Link */}
          <div>
            <a
              href="https://www.roadhousetwinlakes.com/about-5"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: '#1a2e1a' }}
            >
              Contact us!
            </a>
          </div>

          {/* Copyright */}
          <div className="text-sm" style={{ color: '#5a5046' }}>
            <span>&copy;2025 by Roadhouse Lodge.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
