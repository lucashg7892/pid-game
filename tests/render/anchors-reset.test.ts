import { describe, expect, it } from 'vitest';
import { createAnchors, resetAnchors } from '../../src/render/level-display';

describe('resetAnchors', () => {
  it('remet toutes les ancres à zéro et masque les repères conditionnels', () => {
    const a = createAnchors();
    for (const p of [a.console, a.cabin, a.errorDimension, a.walkerHead, a.forceGauge]) {
      p.x = 157;
      p.y = 611;
    }
    for (const p of [a.gaugeMax, a.gaugeWeight, a.iGauge]) {
      p.x = 3;
      p.y = 4;
    }
    a.errorDimensionVisible = true;
    a.iGaugeVisible = true;
    resetAnchors(a);
    expect(a).toEqual(createAnchors());
  });
});
