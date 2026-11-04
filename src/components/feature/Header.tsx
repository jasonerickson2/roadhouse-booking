import { Link, useLocation } from 'react-router-dom';

const LOGO = 'https://static.wixstatic.com/media/78598d_1f820102874e4d1c95c1acb4060f6a28~mv2.png';

export default function Header() {
  // On a room page, a Back to rooms button keeps the guest's dates, guests and pets.
  const loc = useLocation();
  const onRoom = loc.pathname.startsWith('/room/');
  return (
    <header>
      <a className="brand" href="https://www.roadhousetwinlakes.com/" aria-label="Roadhouse Twin Lakes home">
        <img className="logo" src={LOGO} alt="" />
        <span className="wm"><b>Roadhouse Twin Lakes</b><small>Coffee · Soft Serve · Lodging</small></span>
      </a>
      {onRoom && <Link className="hdr-back" to={`/${loc.search}`}>‹ Back to rooms</Link>}
      <nav>
        <a href="https://www.roadhousetwinlakes.com/">Home</a>
        <a href="https://www.roadhousetwinlakes.com/about-5-1">Café Menu</a>
        <a href="https://www.roadhousetwinlakes.com/about-3">Recs</a>
        <a href="https://www.roadhousetwinlakes.com/blank-2">About</a>
      </nav>
    </header>
  );
}
