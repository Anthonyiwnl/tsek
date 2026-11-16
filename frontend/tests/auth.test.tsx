import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), $fetch: vi.fn(), signIn: { email: vi.fn() }, signUp: { email: vi.fn() }, emailOtp: { verifyEmail: vi.fn(), sendVerificationOtp: vi.fn() }, signOut: vi.fn() }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => mocks }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: AuthenticatedWorkspace } = await import('../src/AuthenticatedWorkspace');
const citizen = { id: 'citizen-1', name: 'Synthetic Citizen', email: 'citizen@example.test' };
const signedIn = { user: citizen, session: { token: 'test-session-token' } };
beforeEach(() => {
  vi.clearAllMocks(); window.location.hash = '/applications';
  mocks.getSession.mockResolvedValue({ data: null }); mocks.$fetch.mockResolvedValue({ data: { token: 'test-session-token' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], hasMore: false }))));
});

async function fillRegistration() {
  await userEvent.type(await screen.findByLabelText('Full name'), 'Synthetic Citizen');
  await userEvent.type(screen.getByLabelText('Email address'), 'citizen@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
}

test('registration uses Neon and waits for an authenticated session before opening records', async () => {
  mocks.signUp.email.mockResolvedValue({ data: { user: citizen } });
  render(<AuthenticatedWorkspace authMode="signup" />);
  await fillRegistration();
  mocks.getSession.mockResolvedValue({ data: signedIn });
  await userEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }));
  expect(mocks.signUp.email).toHaveBeenCalledWith({ name: 'Synthetic Citizen', email: 'citizen@example.test', password: 'synthetic-password' });
  expect(await screen.findByText('Signed in as Synthetic Citizen')).toBeTruthy();
});

test('registration errors keep private records closed and allow retry', async () => {
  mocks.signUp.email.mockResolvedValue({ error: { message: 'Duplicate user' } });
  render(<AuthenticatedWorkspace authMode="signup" />);
  await fillRegistration();
  await userEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not create your account');
  expect(fetch).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
});

test('signup without a session supports email-code verification instead of opening private records', async () => {
  mocks.signUp.email.mockResolvedValue({ data: { user: citizen } });
  mocks.emailOtp.verifyEmail.mockResolvedValue({ error: { message: 'Expired code' } });
  render(<AuthenticatedWorkspace authMode="signup" />);
  await fillRegistration();
  await userEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Email verification code'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Verify email code' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not verify this code');
  expect(fetch).not.toHaveBeenCalled();
  mocks.emailOtp.verifyEmail.mockResolvedValue({});
  mocks.getSession.mockResolvedValue({ data: signedIn });
  await userEvent.click(screen.getByRole('button', { name: 'Verify email code' }));
  expect(mocks.emailOtp.verifyEmail).toHaveBeenCalledWith({ email: 'citizen@example.test', otp: '123456' });
  expect(await screen.findByText('Signed in as Synthetic Citizen')).toBeTruthy();
});

test('pending signup disables submission and mode switching; a network failure restores the form', async () => {
  let reject: (reason: unknown) => void = () => {};
  mocks.signUp.email.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  render(<AuthenticatedWorkspace authMode="signup" />);
  await fillRegistration();
  await userEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }));
  expect((screen.getByRole('button', { name: 'Creating account...' }) as HTMLButtonElement).disabled).toBe(true);
  for (const button of screen.getAllByRole('button', { name: 'Already registered? Sign in' })) expect((button as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new TypeError('network')));
  expect((await screen.findByRole('alert')).textContent).toContain('Unable to create your account');
  expect(mocks.signUp.email).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
test('uses the Neon cached session JWT without relying on a token-shaped raw endpoint response', async () => {
  mocks.getSession.mockResolvedValue({ data: signedIn });
  mocks.$fetch.mockResolvedValue({ data: signedIn });
  render(<AuthenticatedWorkspace />);
  expect(await screen.findByRole('heading', { name: 'No applications yet' })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('/api/applications?limit=100&offset=0', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' }) }));
  expect(mocks.$fetch).not.toHaveBeenCalled();
});
test('failed sign-in never opens application records', async () => {
  mocks.signIn.email.mockResolvedValue({ error: { message: 'Invalid password' } }); render(<AuthenticatedWorkspace />);
  await userEvent.type(await screen.findByLabelText('Email address'), 'citizen@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('Sign-in failed');
  expect(fetch).not.toHaveBeenCalled();
});
test.each([
  [Object.assign(new Error('Invalid credentials'), { status: 401 }), 'Sign-in failed'],
  [new TypeError('Failed to fetch'), 'Unable to reach sign-in'],
])('rejected sign-in displays the appropriate guidance: %s', async (error, message) => {
  mocks.signIn.email.mockRejectedValueOnce(error);
  render(<AuthenticatedWorkspace />);
  await userEvent.type(await screen.findByLabelText('Email address'), 'citizen@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain(message);
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.getSession).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: 'Sign in', exact: true }) as HTMLButtonElement).disabled).toBe(false);

  mocks.signIn.email.mockResolvedValueOnce({});
  mocks.getSession.mockResolvedValue({ data: signedIn });
  await userEvent.clear(screen.getByLabelText('Password'));
  await userEvent.type(screen.getByLabelText('Password'), 'correct-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect(await screen.findByText('Signed in as Synthetic Citizen')).toBeTruthy();
});

test('an expired backend session clears private records and returns to sign-in', async () => {
  mocks.getSession.mockResolvedValue({ data: signedIn });
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
  expect(mocks.$fetch).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

test('session lookup failure keeps the workspace mounted for retry', async () => {
  mocks.getSession.mockResolvedValueOnce({ data: { user: citizen } }).mockResolvedValue({ error: { message: 'temporary outage' } });
  render(<AuthenticatedWorkspace />);
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'My applications' })).toBeTruthy();
  expect(screen.queryByLabelText('Password')).toBeNull();
});

test('sign-out retry is disabled while pending and handles rejection', async () => {
  mocks.getSession.mockResolvedValue({ data: signedIn });
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
  mocks.getSession.mockResolvedValueOnce({ data: signedIn });
  let finish: (value: unknown) => void = () => {};
  mocks.getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mocks.getSession.mockResolvedValue({ data: signedIn });
  mocks.signOut.mockResolvedValue({});
  render(<AuthenticatedWorkspace />);
  await screen.findByRole('heading', { name: 'My applications' });
  await userEvent.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
  const nextUser = { ...citizen, id: 'citizen-2', name: 'Second Citizen' };
  mocks.getSession.mockResolvedValue({ data: { user: nextUser, session: { token: 'new-result' } } });
  mocks.signIn.email.mockResolvedValue({});
  await userEvent.type(await screen.findByLabelText('Email address'), 'second@example.test');
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  await screen.findByText('Signed in as Second Citizen');
  await act(async () => finish({ data: { user: citizen, session: { token: 'old-result' } } }));
  expect(screen.getByText('Signed in as Second Citizen')).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => (init?.headers as Record<string, string> | undefined)?.Authorization !== 'Bearer old-result')).toBe(true);
});
