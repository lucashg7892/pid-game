/**
 * Ancres du chevalet du tableau d'école (T-042) : coins haut gauche et bas droit en pixels,
 * calculés comme les autres ancres, d'après les constantes du dessin.
 */
import { describe, expect, it } from 'vitest';
import { createLevel1 } from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import {
  computeAnchors,
  computeDisplay,
  createAnchors,
  createDisplay,
} from '../../src/render/level-display';
import { EASEL_CENTER_X, EASEL_HEIGHT, EASEL_WIDTH } from '../../src/render/pencil-style';
import { WALKER_SPAWN_X, WALKER_MIN_X, CONSOLE_POST_X } from '../../src/game';

describe('ancres du chevalet', () => {
  it.each([
    [1280, 720],
    [390, 844],
  ])('%i×%i : coins du chevalet posés sur le quai de départ', (width, height) => {
    const level = createLevel1({ animations: false });
    const frame = computeFrame(width, height);
    const display = createDisplay();
    computeDisplay(level.snapshot, display);
    const anchors = createAnchors();
    computeAnchors(frame, width, height, display, level.snapshot, anchors);
    expect(anchors.boardTopLeft.x).toBeCloseTo(
      worldXToPixel(frame, width, EASEL_CENTER_X - EASEL_WIDTH / 2),
      9,
    );
    expect(anchors.boardTopLeft.y).toBeCloseTo(worldYToPixel(frame, height, EASEL_HEIGHT), 9);
    expect(anchors.boardBottomRight.x).toBeCloseTo(
      worldXToPixel(frame, width, EASEL_CENTER_X + EASEL_WIDTH / 2),
      9,
    );
    expect(anchors.boardBottomRight.y).toBeCloseTo(worldYToPixel(frame, height, 0), 9);
    // Environ 1,1 m × 1,6 m.
    const ppm = frame.pixelsPerMeter;
    expect(anchors.boardBottomRight.x - anchors.boardTopLeft.x).toBeCloseTo(1.1 * ppm, 6);
    expect(anchors.boardBottomRight.y - anchors.boardTopLeft.y).toBeCloseTo(1.6 * ppm, 6);
  });

  it("le chevalet est entre le point d'apparition et le poste du bonhomme", () => {
    const min = EASEL_CENTER_X - EASEL_WIDTH / 2;
    const max = EASEL_CENTER_X + EASEL_WIDTH / 2;
    expect(min).toBeGreaterThan(WALKER_SPAWN_X);
    expect(min).toBeGreaterThanOrEqual(WALKER_MIN_X);
    expect(max).toBeLessThan(CONSOLE_POST_X);
  });
});
