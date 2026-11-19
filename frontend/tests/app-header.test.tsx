import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppHeader from '../src/AppHeader';

test('AppHeader keeps link destinations, signed-in name and keyboard sign out', async () => {
  const signOut = vi.fn();
  const links = [{ href: '#/dashboard', label: 'Dashboard' }, { href: '#/applications', label: 'My applications' }, { href: '#/admin', label: 'My dashboard' }];
  render(<AppHeader name="Maria Santos" links={links} onSignOut={signOut} />);
  const header = screen.getByRole('banner');
  const nav = within(header).getByRole('navigation', { name: 'Workspace' });
  for (const link of links) {
    expect(within(nav).getByRole('link', { name: link.label }).getAttribute('href')).toBe(link.href);
    await userEvent.tab();
    expect(document.activeElement).toBe(within(nav).getByRole('link', { name: link.label }));
  }
  expect(within(header).getByText('Signed in as Maria Santos')).toBeTruthy();
  await userEvent.tab();
  expect(document.activeElement).toBe(within(header).getByRole('button', { name: 'Sign out' }));
  await userEvent.keyboard('{Enter}');
  expect(signOut).toHaveBeenCalledOnce();
});

test.each([
  ['Maria Santos', 'MS'], ['  Maria  Clara Santos  ', 'MS'], ['Hero', 'H'], ['', ''], ['   ', ''], ['Éva Santos', 'ÉS'],
])('AppHeader derives decorative initials for %j', (name, initials) => {
  const { container } = render(<AppHeader name={name} links={[]} onSignOut={() => {}} />);
  const avatar = container.querySelector('.app-header-initials');
  expect(avatar?.textContent).toBe(initials);
  expect(avatar?.getAttribute('aria-hidden')).toBe('true');
});

test('workspace menu closes on Escape with focus restored and on navigation', async () => {
  render(<AppHeader name="Demo citizen" links={[{ href: '#/applications', label: 'My applications' }]} onSignOut={() => {}} />);
  const toggle = screen.getByRole('button', { name: 'Workspace menu' });
  await userEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  await userEvent.click(screen.getByRole('link', { name: 'My applications' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await userEvent.click(toggle);
  screen.getByRole('link', { name: 'My applications' }).focus();
  await userEvent.keyboard('{Escape}');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
});
