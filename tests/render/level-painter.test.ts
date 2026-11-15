import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_LEDGE_HEIGHT,
  CABIN_CENTER_X,
  CONSOLE_X,
  createLevel1,
  type Level1,
  type LevelSnapshot,
} from '../../src/game';
import { computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import {
  CONSOLE_ANCHOR_Y,
  GAUGE_LABEL_X,
  WALKER_HEAD_TOP,
  choosePose,
  computeAnchors,
  computeDisplay,
  createAnchors,
  createDisplay,
  effectivePhase,
} from '../../src/render/level-display';
import { BATCH_CAPACITY, LevelPainter } from '../../src/render/level-painter';
import { GAUGE_WEIGHT_Y } from '../../src/render/gauge';
import { DIMENSION_X, GAUGE_MAX_X, GAUGE_MAX_Y, GAUGE_MIN_X } from '../../src/render/pencil-style';
import { CURVE_ORIGIN_X, CURVE_SPAN } from '../../src/render/curve';

const FRAME = 1 / 60;
const PIXEL = 1 / 75.3; // 1280×720 : 75,3 px/m

function toConsole(level: Level1): void {
  level.moveRight();
  for (let i = 0; i < 1000 && !level.snapshot.atConsole; i += 1) level.update(FRAME);
  level.stop();
  expect(level.interact()).toBe('accepted');
}

/** Joue un trajet en peignant chaque image ; renvoie le maximum de triangles observé. */
function playTrip(
  kp: number,
  painter: LevelPainter,
  level: Level1 = createLevel1({ animations: false }),
): number {
  painter.setPixelSize(PIXEL);
  let time = 0;
  toConsole(level);
  expect(level.setKp(kp)).toBe('accepted');
  expect(level.launch()).toBe('accepted');
  let maxTriangles = 0;
  for (let i = 0; i < 2000 && level.snapshot.phase === 'trip'; i += 1) {
    level.update(FRAME);
    time += FRAME;
    painter.paint(level.snapshot, level.signals, time, false);
    maxTriangles = Math.max(maxTriangles, painter.vertexCount / 3);
    expect(painter.dropped).toBe(0);
  }
  painter.paint(level.snapshot, level.signals, time, false);
  return maxTriangles;
}

describe('LevelPainter', () => {
  it('état initial : décor, bonhomme, cabine, levier ; ni courbe ni erreur ni jauge', () => {
    const painter = new LevelPainter();
    const level = createLevel1({ animations: false });
    painter.setPixelSize(PIXEL);
    painter.paint(level.snapshot, level.signals, 0, false);
    expect(painter.decor.vertexCount).toBeGreaterThan(1000);
    expect(painter.actors.vertexCount).toBeGreaterThan(100);
    expect(painter.curve.vertexCount).toBe(0);
    expect(painter.error.vertexCount).toBe(0);
    expect(painter.red.vertexCount).toBe(0);
    expect(painter.dropped).toBe(0);
    expect(painter.display.pose).toBe('stand');
    expect(painter.display.walkerX).toBe(-5.5);
  });

  for (const [kp, outcome, k] of [
    [2500, 'win', 291],
    [7000, 'bonk', 56],
    [800, 'step', 1200],
    [100, 'noLift', 1200],
  ] as const) {
    it(`Kp = ${String(kp)} : ${outcome} au pas ${String(k)}, sans débordement, budget tenu`, () => {
      const painter = new LevelPainter();
      const level = createLevel1({ animations: false });
      const maxTriangles = playTrip(kp, painter, level);
      expect(level.snapshot.outcome).toBe(outcome);
      expect(level.snapshot.outcomeK).toBe(k);
      expect(maxTriangles).toBeLessThanOrEqual(30_000);
      // La pointe de la courbe touche le plancher affiché.
      const trace = painter.trace;
      expect(trace.count).toBe(k + 1);
      expect(trace.points[2 * trace.count - 1]).toBe(painter.display.cabinY);
      for (let i = 0; i < trace.count; i += 1) {
        const x = trace.points[2 * i] as number;
        expect(x).toBeGreaterThanOrEqual(CURVE_ORIGIN_X);
        expect(x).toBeLessThanOrEqual(CURVE_ORIGIN_X + CURVE_SPAN + 1e-9);
      }
      expect(painter.curve.vertexCount).toBeGreaterThan(0);
      expect(painter.error.vertexCount).toBeGreaterThan(0);
      const pose = { win: 'cheer', bonk: 'bonk', step: 'akimbo', noLift: 'shrug' }[outcome];
      expect(painter.display.pose).toBe(pose);
    });
  }

  it('jauge : crayon rouge seulement quand la force est saturée', () => {
    const painter = new LevelPainter();
    const level = createLevel1({ animations: false });
    toConsole(level);
    level.setKp(2500);
    level.launch();
    let sawRed = false;
    let sawGraphiteOnly = false;
    for (let i = 0; i < 400 && level.snapshot.phase === 'trip'; i += 1) {
      level.update(FRAME);
      painter.paint(level.snapshot, level.signals, 0, true);
      if (level.snapshot.saturated) {
        expect(painter.red.vertexCount).toBeGreaterThan(0);
        sawRed = true;
      } else {
        expect(painter.red.vertexCount).toBe(0);
        sawGraphiteOnly = true;
      }
    }
    expect(sawRed).toBe(true);
    expect(sawGraphiteOnly).toBe(true);
  });

  it('cote d’erreur seulement à la victoire', () => {
    const win = new LevelPainter();
    const levelWin = createLevel1({ animations: false });
    playTrip(2500, win, levelWin);
    const step = new LevelPainter();
    playTrip(800, step);
    const anchors = createAnchors();
    const frame = computeFrame(1280, 720);
    computeAnchors(frame, 1280, 720, win.display, levelWin.snapshot, anchors);
    expect(anchors.errorDimensionVisible).toBe(true);
    expect(anchors.errorDimension.x).toBeCloseTo(worldXToPixel(frame, 1280, DIMENSION_X), 9);
    expect(anchors.errorDimension.y).toBeCloseTo(
      worldYToPixel(frame, 720, (levelWin.snapshot.cabinY + ARRIVAL_LEDGE_HEIGHT) / 2),
      9,
    );
  });

  it('boiling : décor redessiné 8 fois par seconde, jamais avec prefers-reduced-motion', () => {
    const level = createLevel1({ animations: false });
    const boiling = new LevelPainter();
    const still = new LevelPainter();
    for (let i = 0; i <= 60; i += 1) {
      boiling.paint(level.snapshot, level.signals, i * FRAME, false);
      still.paint(level.snapshot, level.signals, i * FRAME, true);
    }
    expect(boiling.decorBuilds).toBe(9);
    expect(still.decorBuilds).toBe(1);
    still.setPixelSize(0.02);
    still.paint(level.snapshot, level.signals, 2, true);
    expect(still.decorBuilds).toBe(2);
    still.setPixelSize(Number.NaN);
    still.paint(level.snapshot, level.signals, 2, true);
    expect(still.decorBuilds).toBe(3);
  });

  it('aucune allocation : 1000 mises à jour gardent les mêmes ArrayBuffer', () => {
    const painter = new LevelPainter();
    const level = createLevel1({ animations: false });
    painter.setPixelSize(PIXEL);
    toConsole(level);
    level.setKp(3500);
    level.launch();
    painter.paint(level.snapshot, level.signals, 0, false);
    const buffers = painter.batches.flatMap((b) => [b.positions.buffer, b.strokes.buffer]);
    const traceBuffer = painter.trace.points.buffer;
    const display = painter.display;
    let time = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (i === 500) {
        level.restart();
        level.launch();
      }
      level.update(FRAME);
      time += FRAME;
      painter.paint(level.snapshot, level.signals, time, false);
    }
    const after = painter.batches.flatMap((b) => [b.positions.buffer, b.strokes.buffer]);
    expect(after.length).toBe(10);
    after.forEach((buffer, i) => {
      expect(buffer).toBe(buffers[i]);
    });
    expect(painter.trace.points.buffer).toBe(traceBuffer);
    expect(painter.display).toBe(display);
    expect(painter.decor.capacity).toBe(BATCH_CAPACITY.decor);
  });

  it('ne garde aucune référence à l’instantané', () => {
    const painter = new LevelPainter();
    const level = createLevel1({ animations: false });
    painter.paint(level.snapshot, level.signals, 0, false);
    const values = Object.values(painter as unknown as Record<string, unknown>);
    expect(values).not.toContain(level.snapshot);
    expect(values).not.toContain(level.signals);
  });
});

describe('état affiché et ancres', () => {
  function snapshot(over: Partial<LevelSnapshot>): LevelSnapshot {
    return { ...createLevel1({ animations: false }).snapshot, ...over };
  }
  it('interpole la cabine pendant le trajet, la fige à l’issue', () => {
    const d = createDisplay();
    computeDisplay(
      snapshot({
        phase: 'trip',
        cabinPrevY: 1,
        cabinY: 2,
        alpha: 0.25,
        walkerAction: 'inCabin',
        walkerInCabin: true,
        walkerX: CABIN_CENTER_X,
        walkerPrevX: CABIN_CENTER_X,
        walkerPrevY: 1,
        walkerY: 2,
      }),
      d,
    );
    expect(d.cabinY).toBe(1.25);
    expect(d.walkerX).toBe(CABIN_CENTER_X);
    expect(d.walkerGround).toBe(1.25);
    expect(d.pose).toBe('stand');
    computeDisplay(
      snapshot({ phase: 'outcome', cabinPrevY: 1, cabinY: 2, alpha: 0.25, outcome: 'win' }),
      d,
    );
    expect(d.cabinY).toBe(2);
  });
  it('interpole le bonhomme sur le quai', () => {
    const d = createDisplay();
    computeDisplay(
      snapshot({ walkerPrevX: -3, walkerX: -2, alpha: 0.5, walkerMoving: true, walkerFacing: -1 }),
      d,
    );
    expect(d.walkerX).toBe(-2.5);
    expect(d.facing).toBe(-1);
    expect(d.pose).toBe('walk');
  });
  it('en pause : phase et attitude de la phase qui reprendra', () => {
    const s = snapshot({ phase: 'paused', resumePhase: 'tuning', walkerAction: 'atPost' });
    expect(effectivePhase(s)).toBe('tuning');
    expect(choosePose('tuning', s)).toBe('reach');
    expect(effectivePhase(snapshot({ phase: 'paused', resumePhase: null }))).toBe('paused');
    expect(choosePose('outcome', snapshot({ outcome: null }))).toBe('stand');
    expect(choosePose('trip', snapshot({ walkerAction: 'inCabin' }))).toBe('stand');
  });
  it('attitude d’après l’action du bonhomme', () => {
    const pose = (walkerAction: LevelSnapshot['walkerAction'], moving = false): string =>
      choosePose('tuning', snapshot({ walkerAction, walkerMoving: moving }));
    expect(pose('free')).toBe('stand');
    expect(pose('free', true)).toBe('walk');
    expect(pose('toPost')).toBe('walk');
    expect(pose('atPost')).toBe('reach');
    expect(pose('boarding')).toBe('walk');
    expect(pose('inCabin')).toBe('stand');
    expect(pose('exiting')).toBe('walk');
    expect(pose('stepping')).toBe('walk');
    expect(pose('arrived')).toBe('stand');
    // L'issue prime sur l'action : fête sur le plateau, échecs à bord.
    const outcome = (o: LevelSnapshot['outcome']): string =>
      choosePose('outcome', snapshot({ walkerAction: 'inCabin', outcome: o }));
    expect(choosePose('outcome', snapshot({ walkerAction: 'arrived', outcome: 'win' }))).toBe(
      'cheer',
    );
    expect(outcome('bonk')).toBe('bonk');
    expect(outcome('step')).toBe('akimbo');
    expect(outcome('noLift')).toBe('shrug');
  });
  it('dessine le bonhomme à la position du snapshot, sans dépendre de walkerInCabin', () => {
    const d = createDisplay();
    const base = { phase: 'exit', walkerAction: 'exiting', walkerFacing: 1, cabinY: 2.9 } as const;
    // Marche dans la cabine : x intermédiaire entre 2 et 3,8, pieds au plancher.
    const inside = {
      ...base,
      walkerPrevX: 2.9,
      walkerX: 3.1,
      alpha: 0.5,
      walkerPrevY: 2.9,
      walkerY: 2.9,
    };
    computeDisplay(snapshot({ ...inside, walkerInCabin: true }), d);
    const first = { x: d.walkerX, y: d.walkerGround };
    computeDisplay(snapshot({ ...inside, walkerInCabin: false }), d);
    expect(d.walkerX).toBeCloseTo(3, 12);
    expect(d.walkerX).toBe(first.x);
    expect(d.walkerGround).toBe(first.y);
    expect(d.walkerGround).toBe(2.9);
    expect(d.pose).toBe('walk');
    // Pendant le pas : pieds interpolés entre la hauteur de la cabine et celle du plateau.
    computeDisplay(
      snapshot({
        ...base,
        walkerAction: 'stepping',
        walkerPrevX: 3.8,
        walkerX: 3.9,
        alpha: 0.5,
        walkerPrevY: 2.9,
        walkerY: 3,
      }),
      d,
    );
    expect(d.walkerX).toBeCloseTo(3.85, 12);
    expect(d.walkerGround).toBeCloseTo(2.95, 12);
    // Sur le plateau : à la hauteur r, pas dans la masse.
    computeDisplay(
      snapshot({
        phase: 'outcome',
        outcome: 'win',
        walkerAction: 'arrived',
        walkerPrevX: 4.5,
        walkerX: 4.6,
        alpha: 0.5,
        walkerPrevY: 3,
        walkerY: 3,
      }),
      d,
    );
    expect(d.walkerGround).toBe(3);
    expect(d.pose).toBe('cheer');
  });
  it('la hauteur ne s’interpole pas à l’issue (cabine figée) ni hors trajet', () => {
    const d = createDisplay();
    computeDisplay(
      snapshot({
        phase: 'outcome',
        outcome: 'bonk',
        walkerAction: 'inCabin',
        cabinY: 2,
        cabinPrevY: 1,
        walkerY: 2,
        walkerPrevY: 1,
        alpha: 0.5,
      }),
      d,
    );
    expect(d.walkerGround).toBe(2);
    expect(d.cabinY).toBe(2);
  });
  it('ancres de la console, de la cabine et de la tête', () => {
    const frame = computeFrame(1280, 720);
    const d = createDisplay();
    const s = snapshot({});
    computeDisplay(s, d);
    const a = createAnchors();
    computeAnchors(frame, 1280, 720, d, s, a);
    expect(a.console.x).toBeCloseTo(worldXToPixel(frame, 1280, CONSOLE_X), 9);
    expect(a.console.y).toBeCloseTo(worldYToPixel(frame, 720, CONSOLE_ANCHOR_Y), 9);
    expect(a.cabin.x).toBeCloseTo(worldXToPixel(frame, 1280, CABIN_CENTER_X), 9);
    expect(a.cabin.y).toBeCloseTo(worldYToPixel(frame, 720, 0), 9);
    expect(a.walkerHead.x).toBeCloseTo(worldXToPixel(frame, 1280, -5.5), 9);
    expect(a.walkerHead.y).toBeCloseTo(worldYToPixel(frame, 720, WALKER_HEAD_TOP), 9);
    expect(a.errorDimensionVisible).toBe(false);
    expect(a.forceGauge.x).toBeCloseTo(
      worldXToPixel(frame, 1280, (GAUGE_MIN_X + GAUGE_MAX_X) / 2),
      9,
    );
    expect(a.forceGauge.y).toBeCloseTo(worldYToPixel(frame, 720, GAUGE_MAX_Y), 9);
    // Étiquettes de l'échelle : à droite de la jauge, au haut de l'échelle et au repère du poids.
    expect(a.gaugeMax.x).toBeCloseTo(worldXToPixel(frame, 1280, GAUGE_LABEL_X), 9);
    expect(a.gaugeMax.y).toBeCloseTo(worldYToPixel(frame, 720, GAUGE_MAX_Y), 9);
    expect(a.gaugeWeight.x).toBeCloseTo(a.gaugeMax.x, 9);
    expect(a.gaugeWeight.y).toBeCloseTo(worldYToPixel(frame, 720, GAUGE_WEIGHT_Y), 9);
    expect(a.gaugeWeight.y).toBeGreaterThan(a.gaugeMax.y);
    expect(GAUGE_LABEL_X).toBeGreaterThan(GAUGE_MAX_X);
    expect(WALKER_HEAD_TOP).toBeGreaterThan(1.6);
    expect(WALKER_HEAD_TOP).toBeLessThan(1.9);
  });
});
