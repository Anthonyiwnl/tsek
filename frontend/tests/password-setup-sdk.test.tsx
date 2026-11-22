import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => vi.unstubAllGlobals());

test('installed Neon SDK sends the verified password-reset requests without live services', async () => {
  const requests: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    // All network requests are intercepted; unexpected endpoints fail the test.
    expect(url).toMatch(/^https:\/\/auth\.example\.test\/auth\/email-otp\/(request-password-reset|reset-password)$/);
    requests.push({ url, method: init?.method || 'GET', body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
  const { default: PasswordSetup } = await import('../src/PasswordSetup');
  render(<PasswordSetup />);
  await userEvent.type(screen.getByLabelText('Email'), 'Person@example.test');
  await userEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  await userEvent.type(await screen.findByLabelText('Email code'), '123456');
  await userEvent.type(screen.getByLabelText('New password'), 'synthetic-password');
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Set password', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Your password is ready' })).toBeTruthy();
  expect(requests).toEqual([
    { url: 'https://auth.example.test/auth/email-otp/request-password-reset', method: 'POST', body: { email: 'person@example.test' } },
    { url: 'https://auth.example.test/auth/email-otp/reset-password', method: 'POST', body: { email: 'person@example.test', otp: '123456', password: 'synthetic-password' } },
  ]);
});
