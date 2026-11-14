/**
 * Jauge du terme intégral I au niveau 2 (T-024) : cadre dans le décor, remplissage hachuré
 * proportionnel à |I|, jamais en rouge, absente au niveau 1 ; ancres de ses étiquettes.
 */
import { describe, expect, it } from 'vitest';
import { createLevel1, createLevel2, type Level, type LevelSnapshot } from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { GAUGE_FULL_SCALE, forceToGaugeY } from '../../src/render/gauge';
import {
  GAUGE_I_LABEL_X,
  GAUGE_LABEL_X,
  computeAnchors,
  computeDisplay,
  createAnchors,
  createDisplay,
} from '../../src/render/level-display';
import { LevelPainter } from '../../src/render/level-painter';
import {
  GAUGE_I_MAX_X,
  GAUGE_I_MIN_X,
  GAUGE_MAX_X,
  GAUGE_MAX_Y,
  GAUGE_MIN_Y,
} from '../../src/render/pencil-style';

const FRAME = 1 / 60;
const PIXEL = 1 / 75.3;

/** Niveau prêt à partir (réglage ouvert) avec le Ki donné. */
function ready(level: Level, ki: number): void {
  level.moveRight();
  for (let i = 0; i < 1000 && !level.snapshot.atConsole; i += 1) level.update(FRAME);
  level.stop();
  level.interact();
  level.setTuning(ki);
}

/** Sommets (x) du lot dans la bande d'abscisses de la jauge I, ordonnée sous `top`. */
function verticesInIGauge(painter: LevelPainter, batch: 'actors' | 'red' | 'decor'): number {
  const b = painter[batch];
  let n = 0;
  for (let v = 0; v < b.vertexCount; v += 1) {
    const x = b.positions[3 * v] as number;
    const y = b.positions[3 * v + 1] as number;
    if (
      x > GAUGE_I_MIN_X - 0.2 &&
      x < GAUGE_I_MAX_X + 0.2 &&
      y > GAUGE_MIN_Y - 0.05 &&
      y < GAUGE_MAX_Y + 0.05
    ) {
      n += 1;
    }
  }
  return n;
}

describe('jauge du terme intégral : peintre', () => {
  it('cadre dessiné dès l’approche au niveau 2 (décor), absent au niveau 1', () => {
    const l2 = new LevelPainter();
    const l1 = new LevelPainter();
    l2.setPixelSize(PIXEL);
    l1.setPixelSize(PIXEL);
    l2.paint(createLevel2().snapshot, createLevel2().signals, 0, false);
    l1.paint(createLevel1().snapshot, createLevel1().signals, 0, false);
    expect(verticesInIGauge(l2, 'decor')).toBeGreaterThan(200);
    expect(verticesInIGauge(l1, 'decor')).toBe(0);
    expect(l2.decor.vertexCount).toBeGreaterThan(l1.decor.vertexCount);
    expect(l2.dropped).toBe(0);
  });

  it('remplissage hachuré qui suit |I|, au graphite, jamais en rouge ; valeur finale gardée', () => {
    const painter = new LevelPainter();
    painter.setPixelSize(PIXEL);
    const level = createLevel2();
    ready(level, 800);
    painter.paint(level.snapshot, level.signals, 0, false);
    expect(verticesInIGauge(painter, 'actors')).toBe(0);
    level.launch();
    const counts: number[] = [];
    let sawSaturation = false;
    for (let i = 0; i < 600 && level.snapshot.phase === 'trip'; i += 1) {
      level.update(FRAME);
      painter.paint(level.snapshot, level.signals, i * FRAME, true);
      if (level.snapshot.saturated) {
        sawSaturation = true;
        // La jauge de force est rouge ; la jauge I reste au graphite.
        expect(verticesInIGauge(painter, 'red')).toBe(0);
        expect(painter.red.vertexCount).toBeGreaterThan(0);
      }
      if (i % 20 === 0) counts.push(verticesInIGauge(painter, 'actors'));
      expect(painter.dropped).toBe(0);
    }
    expect(sawSaturation).toBe(true);
    expect(level.snapshot.iTerm).toBeGreaterThan(0);
    expect(counts.some((c) => c > 100)).toBe(true);
    // À l'issue : la valeur finale reste dessinée.
    for (let i = 0; i < 2000 && level.snapshot.phase === 'trip'; i += 1) level.update(FRAME);
    painter.paint(level.snapshot, level.signals, 99, true);
    expect(level.snapshot.phase).toBe('outcome');
    expect(verticesInIGauge(painter, 'actors')).toBeGreaterThan(0);
  });

  it('niveau 1 : aucun trait dans la bande de la jauge I pendant le trajet', () => {
    const painter = new LevelPainter();
    painter.setPixelSize(PIXEL);
    const level = createLevel1();
    ready(level, 2500);
    level.launch();
    for (let i = 0; i < 100; i += 1) {
      level.update(FRAME);
      painter.paint(level.snapshot, level.signals, i * FRAME, true);
    }
    expect(verticesInIGauge(painter, 'actors')).toBe(0);
  });

  it('la valeur absolue est tracée : même niveau pour I et −I, borné à la pleine échelle', () => {
    expect(forceToGaugeY(-300)).toBe(forceToGaugeY(300));
    expect(forceToGaugeY(-2 * GAUGE_FULL_SCALE)).toBe(GAUGE_MAX_Y);
    expect(forceToGaugeY(Number.NaN)).toBe(GAUGE_MIN_Y);
  });
});

describe('jauge du terme intégral : ancres', () => {
  const frame = computeFrame(1280, 720);
  function anchorsFor(s: Readonly<LevelSnapshot>): ReturnType<typeof createAnchors> {
    const d = createDisplay();
    computeDisplay(s, d);
    const a = createAnchors();
    computeAnchors(frame, 1280, 720, d, s, a);
    return a;
  }

  it('niveau 2 : jauge I visible, étiquettes d’échelle à droite de la jauge I', () => {
    const a = anchorsFor(createLevel2().snapshot);
    expect(a.iGaugeVisible).toBe(true);
    expect(a.iGauge.x).toBeCloseTo(
      worldXToPixel(frame, 1280, (GAUGE_I_MIN_X + GAUGE_I_MAX_X) / 2),
      9,
    );
    expect(a.iGauge.y).toBeCloseTo(worldYToPixel(frame, 720, GAUGE_MAX_Y), 9);
    expect(a.gaugeMax.x).toBeCloseTo(worldXToPixel(frame, 1280, GAUGE_I_LABEL_X), 9);
    expect(a.gaugeWeight.x).toBeCloseTo(a.gaugeMax.x, 9);
    expect(GAUGE_I_MIN_X).toBeGreaterThan(GAUGE_MAX_X + 0.3);
    expect(GAUGE_I_LABEL_X).toBeGreaterThan(GAUGE_I_MAX_X);
  });

  it('niveau 1 : pas de jauge I, étiquettes d’échelle à leur place', () => {
    const a = anchorsFor(createLevel1().snapshot);
    expect(a.iGaugeVisible).toBe(false);
    expect(a.gaugeMax.x).toBeCloseTo(worldXToPixel(frame, 1280, GAUGE_LABEL_X), 9);
  });
});
