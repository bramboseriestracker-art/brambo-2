import { Link } from 'react-router-dom';

/* Logo to the left of the BRAMBO wordmark. Replace public/logo.png to change the logo. */
export default function Brand({ to = '/home', className = '' }) {
  return (
    <Link to={to} className={`brand ${className}`} aria-label="Brambo home">
      <img className="brand-logo" src="/logo.png" alt="" width="42" height="42" />
      <span className="brand-word">BRAMBO</span>
    </Link>
  );
}
