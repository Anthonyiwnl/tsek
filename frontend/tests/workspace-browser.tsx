// Development-only entry. Not imported by the application or included in the build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from '../src/ApplicationWorkspace';
import { createApplicationApi } from '../src/application-api.js';
import '../src/index.css';
import '../src/App.css';
if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('Local tests only');
const api = createApplicationApi({ getToken: async () => '00000000-0000-4000-8000-000000000001' });
createRoot(document.getElementById('root')!).render(<><p role="note">Synthetic local test. No real accounts, documents, or AI calls.</p><Workspace api={api} name="Synthetic Citizen" onSignOut={() => location.reload()} /></>);
