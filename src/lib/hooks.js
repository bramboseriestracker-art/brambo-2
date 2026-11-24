import { useEffect, useRef, useState } from 'react';

/* Runs an async loader; returns { data, error, loading, reload, setData }. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useRef(0);
  const load = () => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn).then(
      (data) => id === run.current && setState({ data, error: null, loading: false }),
      (error) => id === run.current && setState({ data: null, error, loading: false })
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { run.current++; }; }, deps);
  return { ...state, reload: load, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} | BRAMBO` : 'BRAMBO | Series tracker'; }, [title]);
}

export function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}
