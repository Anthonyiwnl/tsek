import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApplicationTimeline from '../src/ApplicationTimeline';

test('citizen timeline omits identities while staff can inspect actors and prompt versions', async () => {
  const load = vi.fn().mockResolvedValue([{ id: 'event', event: 'analysed', actor_id: 'private-staff', prompt_version: '1.2.0', created_at: '2026-11-27T01:00:00Z' }]);
  const citizen = render(<ApplicationTimeline load={load} />);
  await screen.findByText('Document analysed');
  expect(screen.queryByText(/private-staff/)).toBeNull();
  citizen.unmount(); render(<ApplicationTimeline load={load} staff />);
  await screen.findByText('Actor: private-staff');
  expect(screen.getByText('Prompt: 1.2.0')).toBeTruthy();
});
