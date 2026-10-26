import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { OtpInput } from '@/components/ui/OtpInput';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

test('native input preserves leading-zero pasted codes and completes once for duplicate native events', async () => {
  const onChange=jest.fn(); const onComplete=jest.fn();
  const screen=await render(<OtpInput value="" onChange={onChange} onComplete={onComplete} />);
  const input=screen.getByTestId('otp-input-hidden-input');
  await fireEvent.changeText(input,'000042'); await fireEvent.changeText(input,'000042');
  expect(onChange).toHaveBeenCalledWith('000042'); expect(onComplete).toHaveBeenCalledTimes(1);
  expect(input.props.textContentType).toBe('oneTimeCode');
});
test('native input strips non-digits, permits editing, and cannot submit while disabled', async () => {
  const onChange=jest.fn(); const onComplete=jest.fn();
  const screen=await render(<OtpInput value="12" onChange={onChange} onComplete={onComplete} />);
  await fireEvent.changeText(screen.getByTestId('otp-input-hidden-input'),'12a3');
  expect(onChange).toHaveBeenCalledWith('123'); expect(onComplete).not.toHaveBeenCalled();
  await screen.rerender(<OtpInput value="123" onChange={onChange} onComplete={onComplete} disabled />);
  await fireEvent.changeText(screen.getByTestId('otp-input-hidden-input'),'123456');
  expect(onComplete).not.toHaveBeenCalled();
});
