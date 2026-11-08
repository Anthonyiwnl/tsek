import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Documents from '../src/ApplicationDocuments';
import { ApiError } from '../src/application-api.js';

function setup() {
  const file = { id: 'file-1', original_name: 'old.txt', revision: 3, analysis_generation: 2 };
  const api = {
    files: vi.fn().mockResolvedValue([file]), analyses: vi.fn().mockResolvedValue([]),
    checklist: vi.fn().mockResolvedValue({ is_complete: false, requirements: [{ id: 'r1', name: 'Proof of residency', status: 'uncertain', reason: 'No matching analyzed document is available.' }] }),
    replace: vi.fn().mockResolvedValue({ ...file, revision: 4 }), upload: vi.fn().mockResolvedValue({ id: 'new-file' }),
    analyze: vi.fn().mockResolvedValue({}), list: vi.fn(), get: vi.fn(), services: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn(),
  };
  render(<Documents api={api} id="app-1" editable />);
  return api;
}

test('replacement sends the displayed revision once, triggers fresh analysis and reloads the checklist', async () => {
  const api = setup();
  await screen.findByText('old.txt');
  await userEvent.selectOptions(screen.getByLabelText('Document to replace'), 'file-1');
  const file = new File(['Synthetic utility bill'], 'new.txt', { type: 'text/plain' });
  await userEvent.upload(screen.getByLabelText('Plain text document'), file);
  let finish: () => void = () => {};
  api.analyze.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({}); }));
  await userEvent.click(screen.getByRole('button', { name: 'Replace and analyze' }));
  await waitFor(() => expect(api.analyze).toHaveBeenCalledWith('app-1', 'file-1'));
  expect(api.replace).toHaveBeenCalledExactlyOnceWith('app-1', 'file-1', 3, file);
  expect(screen.queryByText('No matching analyzed document is available.')).toBeNull();
  api.checklist.mockResolvedValue({ is_complete: true, requirements: [{ id: 'r1', name: 'Proof of residency', status: 'complete', reason: 'Latest document matches.' }] });
  finish();
  await screen.findByText('Latest document matches.');
  expect(api.files).toHaveBeenCalledTimes(2);
});

test('a failed analysis keeps the persisted replacement and offers analysis retry without uploading again', async () => {
  const api = setup();
  await screen.findByText('old.txt');
  api.analyze.mockRejectedValueOnce(new ApiError(504, 'ANALYSIS_TIMEOUT', ''));
  await userEvent.selectOptions(screen.getByLabelText('Document to replace'), 'file-1');
  await userEvent.upload(screen.getByLabelText('Plain text document'), new File(['Synthetic bill'], 'new.txt', { type: 'text/plain' }));
  await userEvent.click(screen.getByRole('button', { name: 'Replace and analyze' }));
  expect((await screen.findByRole('alert')).textContent).toContain('file is saved');
  await userEvent.click(await screen.findByRole('button', { name: 'Analyze old.txt again' }));
  await waitFor(() => expect(api.analyze).toHaveBeenCalledTimes(2));
  expect(api.replace).toHaveBeenCalledTimes(1);
  expect(api.upload).not.toHaveBeenCalled();
});

test('a stale replacement conflict reloads the current file without starting analysis', async () => {
  const api = setup(); await screen.findByText('old.txt');
  api.replace.mockRejectedValueOnce(new ApiError(409, 'FILE_CHANGED', ''));
  await userEvent.selectOptions(screen.getByLabelText('Document to replace'), 'file-1');
  await userEvent.upload(screen.getByLabelText('Plain text document'), new File(['synthetic'], 'new.txt', { type: 'text/plain' }));
  await userEvent.click(screen.getByRole('button', { name: 'Replace and analyze' }));
  expect((await screen.findByRole('alert')).textContent).toContain('document changed');
  await screen.findByText('old.txt');
  expect(api.analyze).not.toHaveBeenCalled();
});
