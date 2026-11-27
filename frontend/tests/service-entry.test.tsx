import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signIn: { email: vi.fn() }, signUp: { email: vi.fn() }, signOut: vi.fn() }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => auth }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: App } = await import('../src/App');
const services = ['Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'].map((name, i) => ({ id: `live-service-${i}`, name }));
const session = { data: { user: { id: 'citizen', email: 'citizen@example.test' }, session: { token: 'test-token' } } };
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '#/');
  auth.getSession.mockResolvedValue({ data: null });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ data: url.includes('document-types') ? services : url.endsWith('/me') ? { role: 'citizen' } : [], hasMore: false }))));
});
for (const mode of ['login', 'signup']) {
  test.each(services)('$name stays selected through ' + mode, async service => {
    render(<App />);
    const links = screen.getAllByRole('link', { name: 'Start this ticket' });
    await userEvent.click(links[services.indexOf(service)]);
    await screen.findByRole('button', { name: 'Sign in', exact: true });
    if (mode === 'signup') {
      await userEvent.click(screen.getByRole('button', { name: 'New to TSEK? Create an account' }));
      await userEvent.type(screen.getByLabelText('Full name'), 'Test Citizen');
    }
    await userEvent.type(screen.getByLabelText('Email'), 'citizen@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
    const authenticate = mode === 'signup' ? auth.signUp.email : auth.signIn.email;
    authenticate.mockImplementation(async () => { auth.getSession.mockResolvedValue(session); return {}; });
    await userEvent.click(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Sign in', exact: true }));
    await screen.findByRole('dialog');
    await waitFor(() => expect((screen.getByLabelText('Service') as HTMLSelectElement).value).toBe(service.id));
    expect(window.location.hash).toBe('#/applications/new?service=' + encodeURIComponent(service.name));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/applications/new'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(window.location.hash).toBe('#/applications'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}
test('a bookmarked service ID opens the form for an existing session and navigation updates it', async () => {
  window.history.replaceState(null, '', '#/applications/new?service=live-service-1');
  auth.getSession.mockResolvedValue(session);
  render(<App />);
  await waitFor(() => expect((screen.getByLabelText('Service') as HTMLSelectElement).value).toBe('live-service-1'));
  await act(async () => { window.location.hash = '/applications/new?service=unknown'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await waitFor(() => expect((screen.getByLabelText('Service') as HTMLSelectElement).value).toBe(''));
  expect(screen.getByRole('dialog')).toBeTruthy();
});
