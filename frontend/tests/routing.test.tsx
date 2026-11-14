import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../src/AuthenticatedWorkspace', () => ({ default: ({ view }: { view: string }) => <h1>Authenticated {view}</h1> }));
import App from '../src/App';

test.each([
  ['/applications/app-1', 'applications'], ['/dashboard', 'dashboard'], ['/admin', 'admin'], ['/admin/queue', 'admin'],
])('App.tsx routes %s through authentication', async (hash, view) => {
  window.location.hash = hash; render(<App />);
  expect(await screen.findByRole('heading', { name: `Authenticated ${view}` })).toBeTruthy();
});
