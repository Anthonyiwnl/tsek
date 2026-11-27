import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EraseApplication from '../src/EraseApplication';
import { PrivacyNotice } from '../src/PrivacyNotice';

test('erasure requires explicit confirmation and the notice states the configured retention', async () => {
  const erase = vi.fn().mockResolvedValue(null), deleted = vi.fn();
  render(<><PrivacyNotice policy={{ enabled: true, retentionDays: 30, version: 'privacy-v1-30' }} /><EraseApplication erase={erase} onDeleted={deleted} /></>);
  expect(screen.getByText(/removed 30 days/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Delete my application and files' }));
  expect(erase).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm permanent deletion' }));
  expect(erase).toHaveBeenCalledTimes(1); expect(deleted).toHaveBeenCalledTimes(1);
});
