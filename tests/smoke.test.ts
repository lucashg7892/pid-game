import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../src/sim';

describe('socle', () => {
  it('expose le pas de simulation fixe de la spec (1/120 s)', () => {
    expect(SIM_DT).toBe(1 / 120);
  });
});
