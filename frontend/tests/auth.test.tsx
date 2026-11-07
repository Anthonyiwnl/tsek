import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), $fetch: vi.fn(), signIn: { email: vi.fn() }, signOut: vi.fn() }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => mocks }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: AuthenticatedWorkspace } = await import('../src/AuthenticatedWorkspace');
const citizen = { id: 'citizen-1', name: 'Synthetic Citizen', email: 'citizen@example.test' };
beforeEach(() => {
  vi.clearAllMocks(); window.location.hash = '/applications';
  mocks.getSession.mockResolvedValue({ data: null }); mocks.$fetch.mockResolvedValue({ data: { token: 'test-session-token' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
});
test('restores an existing session and requests applications with a current JWT', async () => {
  mocks.getSession.mockResolvedValue({ data: { user: citizen } }); render(<AuthenticatedWorkspace />);
  expect(await screen.findByRole('heading', { name: 'New application' })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('/api/document-types', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' }) }));
});
test('failed sign-in never opens application records', async () => {
  mocks.signIn.email.mockResolvedValue({ error: { message: 'Invalid password' } }); render(<AuthenticatedWorkspace />);
  await userEvent.type(await screen.findByLabelText('Email'), 'citizen@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('Sign-in failed');
  expect(fetch).not.toHaveBeenCalled();
});
test('an expired backend session clears private records and returns to sign-in', async () => {
  mocks.getSession.mockResolvedValue({ data: { user: citizen } });
  vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 })); render(<AuthenticatedWorkspace />);
  expect(await screen.findByRole('button', { name: 'Sign in', exact: true })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'My applications' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('session expired');
});
test('an account change before token retrieval cannot send requests under the previous identity', async () => {
  mocks.getSession.mockResolvedValueOnce({ data: { user: citizen } }).mockResolvedValue({ data: { user: { ...citizen, id: 'other-user' } } });
  render(<AuthenticatedWorkspace />);
  expect(await screen.findByRole('button', { name: 'Sign in', exact: true })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test('identity is checked again after token retrieval', async () => {
  mocks.getSession.mockResolvedValueOnce({ data: { user: citizen } }).mockResolvedValueOnce({ data: { user: citizen } }).mockResolvedValue({ data: { user: { ...citizen, id: 'other-user' } } });
  render(<AuthenticatedWorkspace />);
  await screen.findByRole('button', { name: 'Sign in', exact: true });
  expect(mocks.$fetch).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
});

test('session lookup failure keeps the workspace mounted for retry', async () => {
  mocks.getSession.mockResolvedValueOnce({ data: { user: citizen } }).mockResolvedValue({ error: { message: 'temporary outage' } });
  render(<AuthenticatedWorkspace />);
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'My applications' })).toBeTruthy();
  expect(screen.queryByLabelText('Password')).toBeNull();
});

test('sign-out retry is disabled while pending and handles rejection', async () => {
  mocks.getSession.mockResolvedValue({ data: { user: citizen } });
  mocks.signOut.mockRejectedValueOnce(new TypeError('network'));
  render(<AuthenticatedWorkspace />);
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out', exact: true }));
  let reject: (error: unknown) => void = () => {};
  mocks.signOut.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await userEvent.click(await screen.findByRole('button', { name: 'Retry sign out' }));
  expect((screen.getByRole('button', { name: 'Signing out...' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new TypeError('network')));
  expect(mocks.signOut).toHaveBeenCalledTimes(2);
  expect((screen.getByRole('button', { name: 'Retry sign out' }) as HTMLButtonElement).disabled).toBe(false);
});

test('a cancelled old token request cannot sign out a newly signed-in user', async () => {
  mocks.getSession.mockResolvedValue({ data: { user: citizen } });
  let finish: (value: unknown) => void = () => {};
  mocks.$fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mocks.signOut.mockResolvedValue({});
  render(<AuthenticatedWorkspace />);
  await screen.findByRole('heading', { name: 'My applications' });
  await userEvent.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  const nextUser = { ...citizen, id: 'citizen-2', name: 'Second Citizen' };
  mocks.getSession.mockResolvedValue({ data: { user: nextUser } });
  mocks.signIn.email.mockResolvedValue({});
  await userEvent.type(await screen.findByLabelText('Email'), 'second@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  await screen.findByText('Signed in as Second Citizen');
  await act(async () => finish({ data: { token: 'old-result' } }));
  expect(screen.getByText('Signed in as Second Citizen')).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => (init?.headers as Record<string, string> | undefined)?.Authorization !== 'Bearer old-result')).toBe(true);
});
