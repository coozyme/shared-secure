import { describe, expect, it, vi } from 'vitest';
import { idFromPath, takeFragment } from '../src/lib/services/fragment';
import { formatRemaining, formatTtl, formatTtlShort } from '../src/lib/utils/format';

describe('takeFragment', () => {
  it('returns the fragment and strips it from the address bar, keeping router state', () => {
    const location = { hash: '#secret', pathname: '/n/abc', search: '' } as Location;
    const replaceState = vi.fn();
    const state = { 'sveltekit:index': 1 };
    const history = { state, replaceState } as unknown as History;
    expect(takeFragment(location, history)).toBe('secret');
    expect(replaceState).toHaveBeenCalledWith(state, '', '/n/abc');
  });

  it('leaves history alone without a fragment', () => {
    const replaceState = vi.fn();
    const value = takeFragment(
      { hash: '', pathname: '/n/abc', search: '' } as Location,
      {
        state: null,
        replaceState,
      } as unknown as History,
    );
    expect(value).toBe('');
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('idFromPath', () => {
  const id = 'q8XbN2rT0vYw4LmA6sJd1Q';
  it.each([
    [`/n/${id}`, id],
    [`/n/${id}/delete`, id],
    ['/n/_', null],
    ['/n/short', null],
    [`/f/${id}`, null],
  ])('%s → %s', (path, expected) => {
    expect(idFromPath(path, '/n/')).toBe(expected);
  });
});

describe('format', () => {
  it.each([
    [300, '5 minutes', '5 min'],
    [3600, '1 hour', '1 h'],
    [86400, '24 hours', '24 h'],
    [604800, '7 days', '7 d'],
  ])('%i seconds', (seconds, long, short) => {
    expect(formatTtl(seconds)).toBe(long);
    expect(formatTtlShort(seconds)).toBe(short);
  });

  it('formats remaining time', () => {
    expect(formatRemaining(30_000)).toBe('less than a minute');
    expect(formatRemaining(4 * 60_000 + 59_000)).toBe('5 minutes');
    expect(formatRemaining(59 * 60_000 + 59_000)).toBe('1 hour');
    expect(formatRemaining(23 * 3600_000)).toBe('23 hours');
    expect(formatRemaining(7 * 86400_000 - 60_000)).toBe('7 days');
    expect(formatRemaining(-5)).toBe('less than a minute');
  });
});
