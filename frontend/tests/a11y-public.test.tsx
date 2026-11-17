import React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { accessibilityViolations } from './a11y';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), $fetch: vi.fn(), signIn: { email: vi.fn() }, signOut: vi.fn() }));
vi.mock('@neondatabase/auth', () => ({ createAuthClient: () => mocks }));
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/auth');
const { default: App } = await import('../src/App');
const { default: AuthenticatedWorkspace } = await import('../src/AuthenticatedWorkspace');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], hasMore: false }))));
});

test('landing page has no accessibility violations', async () => {
  window.location.hash = '/';
  render(<App />);
  await screen.findAllByRole('heading', { level: 1 });
  expect(await accessibilityViolations()).toEqual([]);
});

test('sign-in screen and its error state have no accessibility violations', async () => {
  window.location.hash = '/applications';
  mocks.signIn.email.mockResolvedValue({ error: { message: 'Invalid password' } });
  render(<AuthenticatedWorkspace />);
  await userEvent.type(await screen.findByLabelText('Email'), 'citizen@example.test');
  expect(await accessibilityViolations()).toEqual([]);
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  await screen.findByRole('alert');
  expect(await accessibilityViolations()).toEqual([]);
});
