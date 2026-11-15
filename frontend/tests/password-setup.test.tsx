import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ emailOtp: { requestPasswordReset: vi.fn(), resetPassword: vi.fn() } }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => mocks }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: PasswordSetup } = await import('../src/PasswordSetup');
beforeEach(() => {
  vi.resetAllMocks();
  mocks.emailOtp.requestPasswordReset.mockResolvedValue({ data: { success: true } });
  mocks.emailOtp.resetPassword.mockResolvedValue({ data: { success: true } });
});
async function requestCode() {
  await userEvent.type(screen.getByLabelText('Email'), 'Person@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  await screen.findByLabelText('Email code');
}
async function enterSecrets(confirmation = 'synthetic-password') {
  await userEvent.type(screen.getByLabelText('Email code'), '123456');
  await userEvent.type(screen.getByLabelText('New password'), 'synthetic-password');
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirmation);
  await userEvent.click(screen.getByRole('button', { name: 'Set password', exact: true }));
}
test('uses inbox verification for password setup and clears secrets on success', async () => {
  render(<PasswordSetup />); await requestCode();
  expect(mocks.emailOtp.requestPasswordReset).toHaveBeenCalledWith({ email: 'person@example.test' });
  expect(screen.getByText(/If an account exists/)).toBeTruthy();
  await enterSecrets();
  expect(mocks.emailOtp.resetPassword).toHaveBeenCalledWith({ email: 'person@example.test', otp: '123456', password: 'synthetic-password' });
  expect(await screen.findByRole('heading', { name: 'Your password is ready' })).toBeTruthy();
  expect(screen.queryByLabelText('New password')).toBeNull();
});
test('mismatched passwords never reach the authentication service', async () => {
  render(<PasswordSetup />); await requestCode(); await enterSecrets('different-password');
  expect(screen.getByRole('alert').textContent).toContain('do not match');
  expect(mocks.emailOtp.resetPassword).not.toHaveBeenCalled();
});
test.each(['response', 'network'])('request failure is retryable without exposing provider details: %s', async kind => {
  if (kind === 'response') mocks.emailOtp.requestPasswordReset.mockResolvedValueOnce({ error: { message: 'private detail' } });
  else mocks.emailOtp.requestPasswordReset.mockRejectedValueOnce(new Error('private detail'));
  render(<PasswordSetup />);
  await userEvent.type(screen.getByLabelText('Email'), 'person@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not request a code');
  expect(screen.queryByText(/private detail/)).toBeNull();
  expect(screen.queryByLabelText('New password')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  expect(await screen.findByLabelText('Email code')).toBeTruthy();
});
test('invalid code does not report success and changing email clears entered secrets', async () => {
  mocks.emailOtp.resetPassword.mockResolvedValueOnce({ error: { message: 'invalid OTP' } });
  render(<PasswordSetup />); await requestCode(); await enterSecrets();
  expect((await screen.findByRole('alert')).textContent).toContain('Check the code');
  expect(screen.queryByRole('heading', { name: 'Your password is ready' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Use another email' }));
  await userEvent.clear(screen.getByLabelText('Email'));
  await userEvent.type(screen.getByLabelText('Email'), 'second@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  expect((await screen.findByLabelText('New password') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Email code') as HTMLInputElement).value).toBe('');
});
