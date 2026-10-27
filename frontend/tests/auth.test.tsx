import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), token: vi.fn(), signIn: { email: vi.fn() }, signOut: vi.fn() }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => mocks }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: AuthenticatedWorkspace } = await import('../src/AuthenticatedWorkspace');
const citizen = { id: 'citizen-1', name: 'Synthetic Citizen', email: 'citizen@example.test' };
beforeEach(() => {
  vi.clearAllMocks(); window.location.hash = '/applications';
  mocks.getSession.mockResolvedValue({ data: null }); mocks.token.mockResolvedValue({ data: { token: 'test-session-token' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
});
test('restores an existing session and requests applications with a current JWT', async () => {
  mocks.getSession.mockResolvedValue({ data: { user: citizen } }); render(<AuthenticatedWorkspace />);
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('/api/applications', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' }) }));
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
