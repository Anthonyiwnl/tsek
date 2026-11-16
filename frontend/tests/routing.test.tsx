import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../src/AuthenticatedWorkspace', () => ({ default: ({ view }: { view: string }) => <h1>Authenticated {view}</h1> }));
vi.mock('../src/PasswordSetup', () => ({ default: () => <h1>Password setup</h1> }));
import App from '../src/App';

test('password setup is reachable without a signed-in workspace', async () => {
  window.location.hash = '/password-setup'; render(<App />);
  expect(await screen.findByRole('heading', { name: 'Password setup' })).toBeTruthy();
});

test.each([
  ['/login', 'applications'], ['/signup', 'applications'], ['/applications/app-1', 'applications'], ['/dashboard', 'dashboard'], ['/admin', 'admin'], ['/admin/queue', 'admin'],
])('App.tsx routes %s through authentication', async (hash, view) => {
  window.location.hash = hash; render(<App />);
  expect(await screen.findByRole('heading', { name: `Authenticated ${view}` })).toBeTruthy();
});
