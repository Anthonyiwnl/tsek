import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
vi.mock('../src/AuthenticatedWorkspace', () => ({ default: ({ view }: { view: string }) => <h1>Authenticated {view}</h1> }));
vi.mock('../src/PasswordSetup', () => ({ default: () => <h1>Password setup</h1> }));
import App from '../src/App';
import { migrateLegacyRoute, navigate, passwordSetupHref, returnDestination, safeDestination, signInHref } from '../src/routing';
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/'); });
test.each([
  ['/login', 'applications'], ['/signup', 'applications'], ['/applications', 'applications'], ['/applications/app-1', 'applications'], ['/applications/new?service=barangay-clearance', 'applications'], ['/admin', 'admin'], ['/admin/queue', 'admin'],
])('path %s opens the appropriate authenticated view', async (path, view) => {
  window.history.replaceState(null, '', path); render(<App />);
  expect(await screen.findByRole('heading', { name: `Authenticated ${view}` })).toBeTruthy();
});
test('password reset and staff return destination work without authentication', async () => {
  window.history.replaceState(null, '', '/password-setup?returnTo=%2Fadmin%2Fqueue'); render(<App />);
  expect(await screen.findByRole('heading', { name: 'Password setup' })).toBeTruthy();
  expect(signInHref()).toBe('/login?returnTo=%2Fadmin%2Fqueue');
});
test.each(['/applications/app-1', '/applications/new?service=barangay-clearance', '/admin/queue', '/password-setup?returnTo=%2Fadmin'])('legacy hash %s is replaced without adding history', async path => {
  window.history.replaceState(null, '', '/#' + path); const length = history.length;
  render(<App />);
  await screen.findByRole('heading', { name: path.startsWith('/password') ? 'Password setup' : path.startsWith('/admin') ? 'Authenticated admin' : 'Authenticated applications' });
  expect(location.hash).toBe(''); expect(location.pathname + location.search).toBe(path); expect(history.length).toBe(length);
});
test('dashboard aliases and back navigation preserve the correct workspace', async () => {
  window.history.replaceState(null, '', '/admin'); render(<App />);
  await screen.findByRole('heading', { name: 'Authenticated admin' });
  await act(async () => navigate('/dashboard'));
  expect(await screen.findByRole('heading', { name: 'Authenticated applications' })).toBeTruthy();
  expect(location.pathname).toBe('/applications');
  await act(async () => { const changed = new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true })); history.back(); await changed; });
  expect(await screen.findByRole('heading', { name: 'Authenticated admin' })).toBeTruthy();
});
test('legacy email parameters are retained and external return destinations are rejected', () => {
  history.replaceState(null, '', '/?token=synthetic#/login?returnTo=%2Fadmin'); migrateLegacyRoute();
  expect(new URLSearchParams(location.search).get('token')).toBe('synthetic');
  expect(returnDestination()).toBe('/admin');
  expect(passwordSetupHref()).toBe('/password-setup?returnTo=%2Fadmin');
  for (const input of ['https://evil.test', '//evil.test', '/\\evil.test', '/other', '/login?returnTo=https://evil.test']) expect(safeDestination(input)).toBeNull();
});
