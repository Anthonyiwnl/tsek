import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequirementReviewForm from '../src/RequirementReviewForm';

test('an override requires a reason and saves the explicit requirement decision', async () => {
  const save = vi.fn().mockResolvedValue({}); render(<RequirementReviewForm aiStatus="uncertain" save={save} />);
  await userEvent.selectOptions(screen.getByLabelText('Your requirement decision'), 'complete');
  await userEvent.click(screen.getByRole('button', { name: 'Record requirement review' }));
  expect(save).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Reason (required)'), 'Original document checked manually');
  await userEvent.click(screen.getByRole('button', { name: 'Record requirement review' }));
  await screen.findByText('Requirement review recorded.');
  expect(save).toHaveBeenCalledWith('complete', 'Original document checked manually');
});
