import React from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
vi.mock('../src/AuthenticatedWorkspace', () => ({ default: ({ view }: { view: string }) => <h1>Authenticated {view}</h1> }));
vi.mock('../src/PasswordSetup', () => ({ default: () => <h1>Password setup</h1> }));
import App from '../src/App';

test('password setup is reachable without a signed-in workspace', async () => {
  window.location.hash = '/password-setup'; render(<App />);
  expect(await screen.findByRole('heading', { name: 'Password setup' })).toBeTruthy();
});

test.each([
  ['/login', 'applications'], ['/signup', 'applications'], ['/applications', 'applications'], ['/applications/app-1', 'applications'], ['/admin', 'admin'], ['/admin/queue', 'admin'],
])('App.tsx routes %s through authentication', async (hash, view) => {
  window.location.hash = hash; render(<App />);
  expect(await screen.findByRole('heading', { name: `Authenticated ${view}` })).toBeTruthy();
});

test('a saved dashboard URL opens My applications and replaces the history entry', async () => {
  window.history.replaceState(null, '', '#/dashboard');
  const length = window.history.length;
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Authenticated applications' })).toBeTruthy();
  expect(window.location.hash).toBe('#/applications');
  expect(window.history.length).toBe(length);
});

test('navigation to the legacy dashboard hash adds only the canonical history entry', async () => {
  window.history.replaceState(null, '', '#/admin');
  render(<App />);
  await screen.findByRole('heading', { name: 'Authenticated admin' });
  const length = window.history.length;
  await act(async () => {
    window.location.hash = '/dashboard';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(await screen.findByRole('heading', { name: 'Authenticated applications' })).toBeTruthy();
  expect(window.location.hash).toBe('#/applications');
  expect(window.history.length).toBe(length + 1);
  await act(async () => {
    const changed = new Promise<void>(resolve => window.addEventListener('hashchange', () => resolve(), { once: true }));
    window.history.back();
    await changed;
  });
  expect(window.location.hash).toBe('#/admin');
  expect(await screen.findByRole('heading', { name: 'Authenticated admin' })).toBeTruthy();
});
