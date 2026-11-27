import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import QueueAuthForm from '../src/QueueAuthForm';
import { LanguageSwitch, useCopy } from '../src/i18n';

beforeEach(() => { localStorage.clear(); window.location.hash = '/'; });
afterEach(() => { localStorage.clear(); });
test('landing language defaults to English and persists Filipino across a remount', async () => {
  const first = render(<App />);
  expect(screen.getByRole('heading', { name: 'Pick your ticket' })).toBeTruthy();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language / Wika' }), 'fil');
  expect(screen.getByRole('heading', { name: 'Piliin ang iyong ticket' })).toBeTruthy();
  expect(document.documentElement.lang).toBe('fil');
  expect(localStorage.getItem('tsek.language')).toBe('fil');
  first.unmount(); render(<App />);
  expect(screen.getByRole('heading', { name: 'Piliin ang iyong ticket' })).toBeTruthy();
});
test('sign-in copy switches without losing entered credentials', async () => {
  render(<QueueAuthForm mode="login" busy={false} configured error="" notice="" verificationEmail="" onSubmit={vi.fn()} onModeChange={vi.fn()} onVerify={vi.fn()} recovery={null} />);
  await userEvent.type(screen.getByLabelText('Email'), 'citizen@example.test');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'fil');
  expect(screen.getByRole('heading', { name: 'Mag-sign in sa iyong mga aplikasyon' })).toBeTruthy();
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('citizen@example.test');
});
test('known checklist messages switch language while unknown document text stays verbatim', async () => {
  function Messages() { const { source } = useCopy(); return <><LanguageSwitch /><p>{source('No matching analyzed document is available.')}</p><p>{source('Personal document text')}</p></>; }
  render(<Messages />);
  expect(screen.getByText('No matching analyzed document is available.')).toBeTruthy();
  await userEvent.selectOptions(screen.getByRole('combobox'), 'fil');
  expect(screen.getByText('Wala pang nasuring dokumentong tumutugma sa kailangan.')).toBeTruthy();
  expect(screen.getByText('Personal document text')).toBeTruthy();
  localStorage.setItem('tsek.language', 'en');
  act(() => window.dispatchEvent(new StorageEvent('storage')));
  expect(document.documentElement.lang).toBe('en');
});
