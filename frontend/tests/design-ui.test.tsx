import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Button } from '../src/DesignUI';

test('Button defaults to medium primary and does not submit a form', async () => {
  const submit = vi.fn(event => event.preventDefault());
  const click = vi.fn();
  render(<form onSubmit={submit}><Button onClick={click}>Save application</Button></form>);
  const button = screen.getByRole('button', { name: 'Save application' });
  expect(button.classList.contains('btn-md')).toBe(true);
  expect(button.classList.contains('btn-primary')).toBe(true);
  await userEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});

test.each(['sm', 'md', 'lg'] as const)('Button supports %s size and decorative icons on both sides', size => {
  render(<Button size={size} variant="secondary" iconLeft="upload" iconRight="arrow" className="custom">Upload document</Button>);
  const button = screen.getByRole('button', { name: 'Upload document' });
  expect(button.classList.contains(`btn-${size}`)).toBe(true);
  expect(button.classList.contains('btn-secondary')).toBe(true);
  expect(button.classList.contains('custom')).toBe(true);
  expect(button.firstElementChild?.tagName).toBe('svg');
  expect(button.lastElementChild?.tagName).toBe('svg');
  expect(button.querySelectorAll('svg[aria-hidden="true"]').length).toBe(2);
});

test('disabled icon Button blocks clicks and keyboard focus; submit Button still submits', async () => {
  const click = vi.fn();
  const submit = vi.fn(event => event.preventDefault());
  render(<form onSubmit={submit}><Button disabled variant="danger" iconLeft="trash" onClick={click}>Delete draft</Button><Button type="submit" variant="ghost" iconRight="check">Confirm deletion</Button></form>);
  await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  expect(click).not.toHaveBeenCalled();
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm deletion' }));
  await userEvent.keyboard('{Enter}');
  expect(submit).toHaveBeenCalledOnce();
});

test.each(['success', 'warning', 'error', 'info', 'neutral'] as const)('Badge preserves the %s label and hides its decoration', tone => {
  render(<Badge tone={tone}>Status</Badge>);
  const badge = screen.getByText('Status');
  expect(badge.classList.contains(`badge-${tone}`)).toBe(true);
  expect(badge.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
});
