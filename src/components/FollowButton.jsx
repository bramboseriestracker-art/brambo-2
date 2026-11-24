import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

export default function FollowButton({ handle, following, onChange, compact = true }) {
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const click = async () => {
    setBusy(true);
    try { const d = await api(`/users/${handle}/follow`, { method: on ? 'DELETE' : 'POST' }); setOn(d.isFollowing); onChange?.(d); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return <button type="button" className={`btn ${on ? 'btn-ghost' : 'btn-primary'} ${compact ? 'btn-compact' : ''}`} onClick={click} disabled={busy} aria-pressed={on}>{on ? 'Following' : 'Follow'}</button>;
}
