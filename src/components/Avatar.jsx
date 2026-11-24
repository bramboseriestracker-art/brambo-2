export default function Avatar({ user, size = '', alt = '' }) {
  if (!user) return null;
  return user.avatar
    ? <img className={`avatar ${size}`} src={user.avatar} alt={alt} loading="lazy" />
    : <span className={`avatar ${size}`} aria-hidden={!alt}>{(user.username || '?')[0].toUpperCase()}</span>;
}
