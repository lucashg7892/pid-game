import { describe, expect, it } from 'vitest';
import { CABIN_WEIGHT } from '../../src/game';
import {
  GAUGE_FULL_SCALE,
  GAUGE_TICK_COUNT,
  GAUGE_WEIGHT_Y,
  forceToGaugeY,
  gaugeFraction,
  gaugeTickY,
  isMajorGaugeTick,
} from '../../src/render/gauge';
import { GAUGE_MAX_Y, GAUGE_MIN_Y } from '../../src/render/pencil-style';

describe('jauge de force', () => {
  it('0 N en bas, 5000 N en haut', () => {
    expect(GAUGE_FULL_SCALE).toBe(5000);
    expect(forceToGaugeY(0)).toBe(GAUGE_MIN_Y);
    expect(forceToGaugeY(5000)).toBeCloseTo(GAUGE_MAX_Y, 12);
  });
  it('remplissage proportionnel à |uSat| / 5000, borné, 0 si non fini', () => {
    for (const f of [0, 250, 490.5, 1234, 2500, 4999]) {
      expect(gaugeFraction(f)).toBeCloseTo(f / 5000, 12);
      expect(gaugeFraction(-f)).toBeCloseTo(f / 5000, 12);
      expect(forceToGaugeY(f) - GAUGE_MIN_Y).toBeCloseTo(
        (f / 5000) * (GAUGE_MAX_Y - GAUGE_MIN_Y),
        12,
      );
    }
    expect(gaugeFraction(7000)).toBe(1);
    expect(gaugeFraction(-7000)).toBe(1);
    expect(gaugeFraction(Number.NaN)).toBe(0);
    expect(gaugeFraction(Infinity)).toBe(0);
  });
  it('11 graduations régulières tous les 500 N, principales tous les 1000 N', () => {
    expect(GAUGE_TICK_COUNT).toBe(11);
    const step = (GAUGE_MAX_Y - GAUGE_MIN_Y) / 10;
    for (let i = 0; i < GAUGE_TICK_COUNT; i += 1) {
      expect(gaugeTickY(i)).toBeCloseTo(GAUGE_MIN_Y + i * step, 12);
      expect(isMajorGaugeTick(i)).toBe(i % 2 === 0);
    }
    expect(gaugeTickY(10)).toBeCloseTo(GAUGE_MAX_Y, 12);
  });
  it('repère du poids m·g = 490,5 N', () => {
    expect(GAUGE_WEIGHT_Y).toBeCloseTo(forceToGaugeY(CABIN_WEIGHT), 12);
    expect(GAUGE_WEIGHT_Y).toBeCloseTo(
      GAUGE_MIN_Y + (490.5 / 5000) * (GAUGE_MAX_Y - GAUGE_MIN_Y),
      9,
    );
  });
});
