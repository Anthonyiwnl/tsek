import { lazy, Suspense, useEffect, useState } from 'react';
import './App.css';
const AuthenticatedWorkspace = lazy(() => import('./AuthenticatedWorkspace'));
const PasswordSetup = lazy(() => import('./PasswordSetup'));

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (hash === '#/password-setup') return <Suspense fallback={<p role="status">Loading password setup...</p>}><PasswordSetup /></Suspense>;
  if (/^#\/(login|signup|applications(?:\/[^/]+)?|dashboard|admin(?:\/(?:overview|applications|queue))?)$/.test(hash)) {
    const view = hash.startsWith('#/admin') ? 'admin' : hash === '#/dashboard' ? 'dashboard' : 'applications';
    return <Suspense fallback={<p role="status">Loading workspace...</p>}><AuthenticatedWorkspace view={view} authMode={hash === '#/signup' ? 'signup' : 'login'} /></Suspense>;
  }
  return <Suspense fallback={<p role="status">Loading sign in...</p>}><AuthenticatedWorkspace view="applications" authMode="login" /></Suspense>;
}
