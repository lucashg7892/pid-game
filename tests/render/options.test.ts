import { describe, expect, it } from 'vitest';
import { MAX_PIXEL_RATIO, capPixelRatio, parseRendererChoice } from '../../src/render/options';

describe('parseRendererChoice', () => {
  it.each([
    ['', 'auto'],
    ['?', 'auto'],
    ['?lang=fr', 'auto'],
    ['?renderer=auto', 'auto'],
    ['?renderer=webgl', 'webgl'],
    ['renderer=webgl', 'webgl'],
    ['?renderer=none', 'none'],
    ['?renderer=WebGL', 'webgl'],
    ['?renderer=NONE', 'none'],
    ['?renderer=%20webgl%20', 'webgl'],
    ['?renderer=webgpu', 'auto'],
    ['?renderer=webgl2', 'auto'],
    ['?renderer=', 'auto'],
    ['?renderer', 'auto'],
    ['?lang=en&renderer=none', 'none'],
    ['?renderer=none&renderer=webgl', 'none'],
    ['?RENDERER=none', 'auto'],
  ] as const)('%s → %s', (search, expected) => {
    expect(parseRendererChoice(search)).toBe(expected);
  });
});

describe('capPixelRatio', () => {
  it.each([
    [1, 1],
    [1.5, 1.5],
    [2, 2],
    [3, MAX_PIXEL_RATIO],
    [0, 1],
    [-1, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ] as const)('%d → %d', (input, expected) => {
    expect(capPixelRatio(input)).toBe(expected);
  });
});
