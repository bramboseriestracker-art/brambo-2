import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const t = useRef();
  const show = useCallback((m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(''), 2800); }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={'toast' + (msg ? ' on' : '')} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}
