import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../src/AuthenticatedWorkspace', () => ({ default: ({ view, authMode }: { view: string; authMode: string }) => <h1 data-auth-mode={authMode}>Authenticated {view}</h1> }));
vi.mock('../src/PasswordSetup', () => ({ default: () => <h1>Password setup</h1> }));
import App from '../src/App';

test.each(['', '/', 'trust', '/unknown'])('entry hash %s opens sign-in instead of the removed landing page', async hash => {
  window.location.hash = hash;
  render(<App />);
  expect((await screen.findByRole('heading', { name: 'Authenticated applications' })).getAttribute('data-auth-mode')).toBe('login');
  expect(screen.queryByText('Your barangay requirements,')).toBeNull();
});

test('password setup is reachable without a signed-in workspace', async () => {
  window.location.hash = '/password-setup'; render(<App />);
  expect(await screen.findByRole('heading', { name: 'Password setup' })).toBeTruthy();
});

test.each([
  ['/login', 'applications'], ['/signup', 'applications'], ['/applications/app-1', 'applications'], ['/dashboard', 'dashboard'], ['/admin', 'admin'], ['/admin/queue', 'admin'],
])('App.tsx routes %s through authentication', async (hash, view) => {
  window.location.hash = hash; render(<App />);
  expect(await screen.findByRole('heading', { name: `Authenticated ${view}` })).toBeTruthy();
});
