import { navigateBackOrReplace } from '@/services/navigation/back';

describe('navigateBackOrReplace', () => {
  it('goes back only when navigation history exists', () => {
    const goBack = jest.fn();
    const replaceFallback = jest.fn();

    navigateBackOrReplace(() => true, goBack, replaceFallback);

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(replaceFallback).not.toHaveBeenCalled();
  });

  it('uses the deterministic fallback when there is no history', () => {
    const goBack = jest.fn();
    const replaceFallback = jest.fn();

    navigateBackOrReplace(() => false, goBack, replaceFallback);

    expect(goBack).not.toHaveBeenCalled();
    expect(replaceFallback).toHaveBeenCalledTimes(1);
  });
});
