import { useEffect, useState } from 'react';

// Full screen photo viewer. Tap a photo anywhere on the room page to open it here, swipe or use the
// arrows to move, Esc or the X to close. All photos from the gallery, not just the first five.
export default function Lightbox({ photos, start, alt, onClose }: { photos: string[]; start: number; alt: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = photos.length;
  const prev = () => setI(x => (x - 1 + n) % n), next = () => setI(x => (x + 1) % n);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); };
    document.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [n]);
  let x0 = 0;
  return (
    <div className="lb" role="dialog" aria-label={`${alt} photos`} onClick={onClose}
      onTouchStart={e => { x0 = e.touches[0].clientX; }} onTouchEnd={e => { const dx = e.changedTouches[0].clientX - x0; if (dx > 50) prev(); if (dx < -50) next(); }}>
      <button className="lb-x" aria-label="Close" onClick={onClose}>×</button>
      <button className="lb-nav lb-prev" aria-label="Previous photo" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
      <img src={photos[i].replace(/\/w\d+$/, '/w1600')} alt={`${alt} photo ${i + 1}`} onClick={e => e.stopPropagation()} />
      <button className="lb-nav lb-next" aria-label="Next photo" onClick={e => { e.stopPropagation(); next(); }}>›</button>
      <div className="lb-count">{i + 1} / {n}</div>
    </div>
  );
}
