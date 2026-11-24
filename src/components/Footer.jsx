import { Link } from 'react-router-dom';
import Brand from './Brand.jsx';

export default function Footer({ guest }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand"><Brand to="/" /><p>Your companion for series discovery, season logging and sharing what you watch.</p></div>
          <div className="footer-col"><h3 className="footer-heading">Navigation</h3><ul>{guest ? <><li><a href="#discover">Discover</a></li><li><a href="#how">How it works</a></li><li><a href="#about">About</a></li></> : <><li><Link to="/home">Home</Link></li><li><Link to="/editors">Editor's choice</Link></li><li><Link to="/people">Friends</Link></li></>}</ul></div>
          {guest && <div className="footer-col"><h3 className="footer-heading">Account</h3><ul><li><Link to="/auth?mode=login">Log in</Link></li><li><Link to="/auth?mode=signup">Create account</Link></li></ul></div>}
          <div className="footer-col"><h3 className="footer-heading">Data source</h3><ul><li><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></li></ul></div>
        </div>
        <div className="footer-legal"><p>&copy; {new Date().getFullYear()} Brambo. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>
      </div>
    </footer>
  );
}
