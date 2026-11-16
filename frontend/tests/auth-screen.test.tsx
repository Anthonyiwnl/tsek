import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthScreen from '../src/AuthScreen';

test('password visibility is accessible and switching modes clears the password and focuses the heading', async () => {
  const onModeChange = vi.fn();
  const props = { busy: false, configured: true, error: '', notice: '', onSubmit: vi.fn(), onModeChange };
  const { rerender } = render(<AuthScreen {...props} mode="login" />);
  await userEvent.type(screen.getByLabelText('Password'), 'private-password');
  await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text');
  await userEvent.click(screen.getAllByRole('button', { name: 'New to TSEK? Create an account' })[0]);
  expect(onModeChange).toHaveBeenCalledWith('signup');
  rerender(<AuthScreen {...props} mode="signup" />);
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBe(document.activeElement);
  expect(screen.getAllByLabelText('Email address')).toHaveLength(1);
});

test('missing configuration gives recovery guidance and cannot submit', async () => {
  const onSubmit = vi.fn();
  render(<AuthScreen mode="login" busy={false} configured={false} error="" notice="" onSubmit={onSubmit} onModeChange={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toContain('not configured');
  expect((screen.getByRole('button', { name: 'Sign in', exact: true }) as HTMLButtonElement).disabled).toBe(true);
  expect(onSubmit).not.toHaveBeenCalled();
});
