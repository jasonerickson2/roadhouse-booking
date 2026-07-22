
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: 'https://www.roadhousetwinlakes.com/' },
    { label: 'Café Menu', href: 'https://www.roadhousetwinlakes.com/about-5-1' },
    { label: 'Recs', href: 'https://www.roadhousetwinlakes.com/about-3' },
    { label: 'About', href: 'https://www.roadhousetwinlakes.com/blank-2' },
  ];

  return (
    <header className="sticky top-0 z-50" style={{ backgroundColor: '#F5EDE4' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo - links to main site */}
          <a href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="https://static.wixstatic.com/media/78598d_1f820102874e4d1c95c1acb4060f6a28~mv2.png"
              alt="Roadhouse Twin Lakes"
              className="h-14 sm:h-16 md:h-20 w-auto"
            />
            <div>
              <span
                className="block text-base sm:text-lg md:text-xl tracking-wider uppercase leading-tight"
                style={{ fontFamily: '"Alfa Slab One", cursive', color: '#1a2e1a', letterSpacing: '0.06em' }}
              >
                Roadhouse Twin Lakes
              </span>
              <span className="hidden sm:block text-[10px] tracking-widest uppercase text-center" style={{ color: '#555', fontFamily: 'Arial, sans-serif' }}>
                Coffee - Soft Serve - Lodging
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium transition-colors tracking-wide"
                style={{ color: '#1a2e1a' }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <i className={`${isMobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'} text-xl text-gray-700`}></i>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t py-3" style={{ borderColor: '#d4c8bb' }}>
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 text-base font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
