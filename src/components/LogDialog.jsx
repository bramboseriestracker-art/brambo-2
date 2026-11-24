import { useEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import Popcorn from './Popcorn.jsx';
import { api, todayISO } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

/* Log a watched season to the diary. */
export default function LogDialog({ open, onClose, show, seasons, initialSeason, runtime, onLogged }) {
  const toast = useToast();
  const [season, setSeason] = useState(initialSeason || seasons[0]?.season_number);
  const [date, setDate] = useState(todayISO());
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [rewatch, setRewatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setSeason(initialSeason || seasons[0]?.season_number); setDate(todayISO()); setRating(0); setNote(''); setRewatch(false); setErr(''); } }, [open, initialSeason]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    const s = seasons.find((x) => x.season_number === Number(season));
    if (!s) return setErr('Choose a season.');
    setBusy(true); setErr('');
    try {
      const d = await api('/diary', { method: 'POST', body: { ...show, season: s.season_number, episodeCount: s.episode_count, runtime, watchedOn: date, rating: rating || undefined, note: note.trim() || undefined, rewatch } });
      toast(`Logged ${show.name}, season ${s.season_number}.`);
      onLogged?.(d.entry);
      onClose();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} label="Log a season">
      <h2 className="dialog-title">Log a season</h2>
      <p className="dialog-message">{show.name}</p>
      <form className="field-row log-form" onSubmit={submit}>
        <label>Season
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((s) => <option key={s.season_number} value={s.season_number}>Season {s.season_number} ({s.episode_count} episodes)</option>)}
          </select>
        </label>
        <label>Date watched<input type="date" value={date} max={todayISO()} min="1950-01-01" onChange={(e) => setDate(e.target.value)} required /></label>
        <div className="rate-line"><span>Your rating (optional)</span><Popcorn value={rating} onChange={setRating} size={26} label="Season rating" showValue /></div>
        <label>Note<textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note for your diary" /></label>
        <label className="check-line"><input type="checkbox" checked={rewatch} onChange={(e) => setRewatch(e.target.checked)} /> I have watched this season before</label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary btn-compact" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save to diary'}</button>
      </form>
    </Dialog>
  );
}
