// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ObservationPanel } from './ObservationPanel.js';

it('cannot mark a definite pollution cause without an independent source', async () => {
  const user = userEvent.setup();
  render(<ObservationPanel />);
  await user.selectOptions(screen.getByLabelText('可能原因'), 'pollution');
  expect(screen.getByText('假设：影像不能单独证明污染')).toBeVisible();
  expect(screen.getByRole('button', { name: '标记为有证据支持' })).toBeDisabled();
  await user.type(screen.getByLabelText('独立证据链接'), 'https://example.gov.cn/evidence');
  expect(screen.getByRole('button', { name: '标记为有证据支持' })).toBeEnabled();
});
