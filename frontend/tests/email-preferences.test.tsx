import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailPreferences from '../src/EmailPreferences';

test('a citizen can disable decision emails from their account', async () => {
  const save = vi.fn().mockResolvedValue({}); render(<EmailPreferences load={async () => ({ enabled: true })} save={save} />);
  await userEvent.click(screen.getByRole('button', { name: 'Email preferences' }));
  await userEvent.click(await screen.findByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Save email preferences' }));
  expect(save).toHaveBeenCalledWith(false);
});
