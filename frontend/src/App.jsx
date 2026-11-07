import "./App.css";
import { lazy, Suspense, useEffect, useState } from "react";
import DesignPreview from "./App.tsx";
const AuthenticatedWorkspace = lazy(() => import('./AuthenticatedWorkspace'));

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  if (hash.startsWith('#/applications')) return <Suspense fallback={<p role="status">Loading workspace...</p>}><AuthenticatedWorkspace /></Suspense>;
  return <DesignPreview />;
}
