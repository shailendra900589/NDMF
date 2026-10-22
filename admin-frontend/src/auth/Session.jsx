import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authApi } from '../api/api';
import PageLoader from '../components/PageLoader';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export default function VerifiedSession({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const token = localStorage.getItem('ndfa_token');

  useEffect(() => {
    if (!token) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await authApi.me();
        if (!result.data?.id || !result.data?.role) throw new Error('Unable to verify your account. Please retry.');
        if (active) {
          localStorage.setItem('ndfa_user', JSON.stringify(result.data));
          setUser(result.data);
          setError('');
        }
      } catch (e) {
        if (active) {
          if (e.status === 403) {
            localStorage.removeItem('ndfa_token');
            localStorage.removeItem('ndfa_user');
            setUser(null);
          }
          setError(e.message || 'Unable to verify your session. Please retry.');
        }
      } finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token, attempt]);

  if (!token) return <Navigate to="/login" replace />;
  if (!user && error) return <div className="card" role="alert" style={{ margin: 32, padding: 28 }}>
    <h2>Unable to open your console</h2><p>{error}</p>
    <button className="btn btn-primary" onClick={() => { setError(''); setAttempt(v => v + 1); }}>Retry</button>
  </div>;
  if (!user) return <PageLoader label="Verifying your account and access…" />;
  return <SessionContext.Provider value={{ user }}>{children}</SessionContext.Provider>;
}
