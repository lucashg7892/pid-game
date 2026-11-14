import { describe, expect, it } from 'vitest';
import { BEAM_HEIGHT, LEVEL_MAX_X, LEVEL_MIN_X } from '../../src/game';
import {
  PLAY_ZONE,
  computeFrame,
  worldXToPixel,
  worldYToPixel,
  type Frame,
} from '../../src/render/camera';
import { BEAM_THICKNESS } from '../../src/render/pencil-style';

const WINDOWS: readonly (readonly [number, number])[] = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [390, 844],
  [3440, 1440],
  [800, 900],
];

function expectFinite(frame: Frame): void {
  for (const value of Object.values(frame)) {
    expect(Number.isFinite(value)).toBe(true);
  }
}

describe('zone de jeu', () => {
  it('contient tout le décor, la poutre et une marge sous le sol', () => {
    expect(PLAY_ZONE.minX).toBeLessThan(LEVEL_MIN_X);
    expect(PLAY_ZONE.maxX).toBeGreaterThan(LEVEL_MAX_X);
    expect(PLAY_ZONE.maxY).toBeGreaterThanOrEqual(BEAM_HEIGHT + 2);
    expect(PLAY_ZONE.minY).toBeLessThanOrEqual(-1);
    expect(PLAY_ZONE).toEqual({ minX: -6.5, maxX: 10.5, minY: -1.5, maxY: 5.5 });
  });
});

describe('computeFrame', () => {
  for (const [width, height] of WINDOWS) {
    it(`${String(width)}×${String(height)} : zone entière visible, sans déformation`, () => {
      const frame = computeFrame(width, height);
      expectFinite(frame);
      expect(frame.left).toBeLessThanOrEqual(PLAY_ZONE.minX + 1e-9);
      expect(frame.right).toBeGreaterThanOrEqual(PLAY_ZONE.maxX - 1e-9);
      expect(frame.bottom).toBeLessThanOrEqual(PLAY_ZONE.minY + 1e-9);
      expect(frame.top).toBeGreaterThanOrEqual(PLAY_ZONE.maxY - 1e-9);
      // La poutre (T-020 : BEAM_HEIGHT = 3,3626 m), épaisseur comprise, reste dans le cadre.
      expect(frame.top).toBeGreaterThan(BEAM_HEIGHT + BEAM_THICKNESS + 1);
      // Même nombre de pixels par mètre en x et en y.
      const pxPerMeterX = width / (frame.right - frame.left);
      const pxPerMeterY = height / (frame.top - frame.bottom);
      expect(pxPerMeterX).toBeCloseTo(pxPerMeterY, 9);
      expect(frame.pixelsPerMeter).toBeCloseTo(pxPerMeterX, 9);
      // Ajustée : la zone touche le bord dans au moins une direction.
      const fitsX = Math.abs(frame.right - frame.left - (PLAY_ZONE.maxX - PLAY_ZONE.minX)) < 1e-9;
      const fitsY = Math.abs(frame.top - frame.bottom - (PLAY_ZONE.maxY - PLAY_ZONE.minY)) < 1e-9;
      expect(fitsX || fitsY).toBe(true);
      // Surplus réparti également : centre de la zone au centre de l'écran.
      expect((frame.left + frame.right) / 2).toBeCloseTo(2, 9);
      expect((frame.top + frame.bottom) / 2).toBeCloseTo(2, 9);
    });
  }

  it('valeurs de référence à 1280×720', () => {
    const frame = computeFrame(1280, 720);
    expect(frame.pixelsPerMeter).toBeCloseTo(1280 / 17, 12);
    expect(frame.left).toBeCloseTo(-6.5, 12);
    expect(frame.right).toBeCloseTo(10.5, 12);
    expect(frame.top).toBeCloseTo(2 + (720 * 17) / 1280 / 2, 12);
    expect(worldYToPixel(frame, 720, 0)).toBeCloseTo((2 + (720 * 17) / 1280 / 2) * (1280 / 17), 9);
    expect(worldXToPixel(frame, 1280, 0)).toBeCloseTo(6.5 * (1280 / 17), 9);
  });

  it('390×844 (portrait) : contraint par la largeur', () => {
    const frame = computeFrame(390, 844);
    expect(frame.right - frame.left).toBeCloseTo(17, 12);
    expect(frame.top - frame.bottom).toBeGreaterThan(7);
  });

  for (const [width, height] of [
    [0, 0],
    [0, 720],
    [1280, 0],
    [-5, 100],
    [Number.NaN, 720],
    [1280, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, Number.NaN],
  ] as const) {
    it(`taille invalide ${String(width)}×${String(height)} : zone exacte, aucun NaN`, () => {
      const frame = computeFrame(width, height);
      expectFinite(frame);
      expect(frame).toEqual({
        left: PLAY_ZONE.minX,
        right: PLAY_ZONE.maxX,
        top: PLAY_ZONE.maxY,
        bottom: PLAY_ZONE.minY,
        pixelsPerMeter: 0,
      });
    });
  }

  it('world→pixel : bords du cadrage aux bords de l’écran', () => {
    const frame = computeFrame(1024, 768);
    expect(worldXToPixel(frame, 1024, frame.left)).toBeCloseTo(0, 9);
    expect(worldXToPixel(frame, 1024, frame.right)).toBeCloseTo(1024, 9);
    expect(worldYToPixel(frame, 768, frame.top)).toBeCloseTo(0, 9);
    expect(worldYToPixel(frame, 768, frame.bottom)).toBeCloseTo(768, 9);
  });
});
