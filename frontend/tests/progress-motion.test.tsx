import React from 'react';
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicketReference from '../src/TicketReference';

test('creation reference has one complete announcement and decorative bounded tiles', () => {
  const { rerender } = render(<TicketReference reference="TSK-123ABC" created />);
  expect(screen.getByRole('status').textContent).toBe('Application created. Reference: TSK-123ABC');
  expect(document.querySelector('.reference-tiles')?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  const tiles = document.querySelectorAll('.reference-tiles > span');
  for (const tile of tiles) expect(parseFloat((tile as HTMLElement).style.getPropertyValue('--tile-delay'))).toBeLessThan(200);
  const first = tiles[0];
  rerender(<TicketReference reference="TSK-123ABC" created />);
  expect(document.querySelector('.reference-tiles > span')).toBe(first);
});
test('a bookmarked ticket does not replay the creation flip', () => {
  render(<TicketReference reference="TSK-123ABC" created={false} />);
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.querySelector('.is-created')).toBeNull();
});
