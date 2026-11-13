import { describe, expect, it } from 'vitest';
import { type StrokeStyle } from '../../src/render/pencil-style';
import {
  POSITION_ITEM_SIZE,
  STROKE_ITEM_SIZE,
  StrokeBatch,
  VERTICES_PER_SEGMENT,
} from '../../src/render/stroke-batch';

/** Style sans tremblé ni effilement : géométrie exacte. */
const EXACT: StrokeStyle = {
  width: 0.04,
  ink: 0.8,
  wobble: 0,
  widthJitter: 0,
  taper: 0,
  subdivide: 0,
  pressure: 0,
};
const WOBBLY: StrokeStyle = { ...EXACT, wobble: 0.01, widthJitter: 0.2, taper: 0.1 };

function vertex(b: StrokeBatch, v: number): { x: number; y: number; across: number; ink: number } {
  return {
    x: b.positions[3 * v] as number,
    y: b.positions[3 * v + 1] as number,
    across: b.strokes[2 * v] as number,
    ink: b.strokes[2 * v + 1] as number,
  };
}

function expectFinite(b: StrokeBatch): void {
  for (let i = 0; i < b.vertexCount * POSITION_ITEM_SIZE; i += 1) {
    expect(Number.isFinite(b.positions[i])).toBe(true);
  }
  for (let i = 0; i < b.vertexCount * STROKE_ITEM_SIZE; i += 1) {
    expect(Number.isFinite(b.strokes[i])).toBe(true);
  }
}

/** Distance signée du point (x, y) à la droite (x0, y0) → (x1, y1). */
function distanceToLine(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return ((x - x0) * dy - (y - y0) * dx) / Math.hypot(dx, dy);
}

/** Vérifie que chaque quad est à demi-largeur `half` de son segment, perpendiculairement. */
function expectConstantWidth(b: StrokeBatch, points: number[], half: number): void {
  let segment = 0;
  for (let i = 0; i + 1 < points.length / 2; i += 1) {
    const x0 = points[2 * i] as number;
    const y0 = points[2 * i + 1] as number;
    const x1 = points[2 * i + 2] as number;
    const y1 = points[2 * i + 3] as number;
    if (Math.hypot(x1 - x0, y1 - y0) < 1e-12) continue;
    for (let k = 0; k < VERTICES_PER_SEGMENT; k += 1) {
      const v = vertex(b, segment * VERTICES_PER_SEGMENT + k);
      const d = Math.abs(distanceToLine(v.x, v.y, x0, y0, x1, y1));
      expect(d).toBeCloseTo(half, 5);
    }
    segment += 1;
  }
  expect(segment * VERTICES_PER_SEGMENT).toBe(b.vertexCount);
}

describe('StrokeBatch : construction', () => {
  it('refuse une capacité invalide', () => {
    expect(() => new StrokeBatch(0)).toThrow(RangeError);
    expect(() => new StrokeBatch(5)).toThrow(RangeError);
    expect(() => new StrokeBatch(7.5)).toThrow(RangeError);
    expect(() => new StrokeBatch(60, 1)).toThrow(RangeError);
  });
  it('préalloue les tableaux à la capacité', () => {
    const b = new StrokeBatch(600);
    expect(b.positions.length).toBe(600 * 3);
    expect(b.strokes.length).toBe(600 * 2);
    expect(b.vertexCount).toBe(0);
  });
});

describe('ruban', () => {
  it('N points → 6(N − 1) sommets, largeur constante perpendiculairement (droite)', () => {
    const b = new StrokeBatch(600);
    const points = [0, 0, 1, 0, 2, 0, 3, 0, 4, 0];
    b.polyline(points, 5, EXACT);
    expect(b.vertexCount).toBe(6 * 4);
    expect(b.triangleCount).toBe(8);
    expectConstantWidth(b, points, EXACT.width / 2);
    expectFinite(b);
  });
  it('largeur constante sur une ligne brisée douce (jointures en onglet)', () => {
    const b = new StrokeBatch(600);
    const points = [0, 0, 1, 0.3, 2, 0, 3, 0.4, 3.5, 1.2, 3.2, 2];
    b.polyline(points, 6, EXACT);
    expectConstantWidth(b, points, EXACT.width / 2);
  });
  it('transversale −1 / +1 et encre du style', () => {
    const b = new StrokeBatch(60);
    b.line(0, 0, 1, 1, EXACT);
    for (let v = 0; v < b.vertexCount; v += 1) {
      expect(Math.abs(vertex(b, v).across)).toBe(1);
      expect(vertex(b, v).ink).toBeCloseTo(0.8, 6);
    }
  });
  it('points colinéaires : sans NaN, largeur constante', () => {
    const b = new StrokeBatch(600);
    const points = [0, 0, 0.5, 0.5, 1, 1, 1.5, 1.5];
    b.polyline(points, 4, EXACT);
    expectFinite(b);
    expectConstantWidth(b, points, EXACT.width / 2);
  });
  it('segments de longueur nulle : ignorés, sans NaN', () => {
    const b = new StrokeBatch(600);
    const points = [0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 2, 0];
    b.polyline(points, 7, EXACT);
    expect(b.vertexCount).toBe(2 * VERTICES_PER_SEGMENT);
    expectFinite(b);
    expectConstantWidth(b, points, EXACT.width / 2);
  });
  it('tous les points confondus, ou un seul point : rien', () => {
    const b = new StrokeBatch(600);
    b.polyline([1, 1, 1, 1, 1, 1], 3, EXACT);
    b.polyline([1, 1], 1, EXACT);
    expect(b.vertexCount).toBe(0);
  });
  it('épingle (demi-tour) : sans NaN, onglet borné', () => {
    const b = new StrokeBatch(600);
    b.polyline([0, 0, 1, 0, 0, 0], 3, EXACT);
    expectFinite(b);
    b.reset();
    b.polyline([0, 0, 1, 0, 0, 1e-7], 3, EXACT);
    expectFinite(b);
    for (let v = 0; v < b.vertexCount; v += 1) {
      expect(Math.abs(vertex(b, v).y)).toBeLessThanOrEqual(3 * EXACT.width + 1e-6);
    }
  });
  it('épaisseur minimale et frange à l’écran (taille de pixel connue)', () => {
    const b = new StrokeBatch(60);
    b.pixelSize = 0.05; // 20 px/m : 0,04 m = 0,8 px < 1,25 px minimum
    b.line(0, 0, 1, 0, EXACT);
    const half = 0.5 * 1.25 * 0.05 + 0.5 * 0.05;
    expect(Math.abs(vertex(b, 0).y)).toBeCloseTo(half, 6);
  });
  it('subdivise selon le style', () => {
    const b = new StrokeBatch(600);
    b.line(0, 0, 1, 0, { ...EXACT, subdivide: 0.25 });
    expect(b.vertexCount).toBe(4 * VERTICES_PER_SEGMENT);
  });
  it('effile les extrémités', () => {
    const b = new StrokeBatch(600);
    b.line(0, 0, 1, 0, { ...EXACT, taper: 0.2, subdivide: 0.1 });
    const end = Math.abs(vertex(b, 0).y);
    const middle = Math.abs(vertex(b, 5 * VERTICES_PER_SEGMENT).y);
    expect(end).toBeLessThan(middle * 0.5);
    expect(middle).toBeCloseTo(EXACT.width / 2, 6);
  });
  it('compte les sommets refusés quand le lot est plein', () => {
    const b = new StrokeBatch(12);
    b.polyline([0, 0, 1, 0, 2, 0, 3, 0], 4, EXACT);
    expect(b.vertexCount).toBe(12);
    expect(b.dropped).toBe(6);
    b.reset();
    expect(b.vertexCount).toBe(0);
    expect(b.dropped).toBe(0);
  });
  it('ignore les points au-delà de la capacité du chemin', () => {
    const b = new StrokeBatch(600, 3);
    b.beginPath();
    for (let i = 0; i < 10; i += 1) b.pathTo(i, 0);
    expect(b.pathLength).toBe(3);
    b.stroke(EXACT);
    expect(b.vertexCount).toBe(2 * VERTICES_PER_SEGMENT);
  });
  it('cercle et rectangle fermés', () => {
    const b = new StrokeBatch(6000);
    b.arc(0, 0, 1, EXACT, 0, 2 * Math.PI, 12);
    expect(b.vertexCount).toBe(12 * VERTICES_PER_SEGMENT);
    b.reset();
    b.rect(0, 0, 1, 1, EXACT);
    expect(b.vertexCount).toBe(4 * VERTICES_PER_SEGMENT);
  });
  it('écrit la profondeur z', () => {
    const b = new StrokeBatch(60);
    b.z = 0.25;
    b.line(0, 0, 1, 0, EXACT);
    expect(b.positions[2]).toBeCloseTo(0.25, 6);
  });
});

describe('variation de pression', () => {
  it('encre dans [ink × (1 − pressure) ; ink], variable le long du trait, continue entre segments', () => {
    const b = new StrokeBatch(6000);
    const style = { ...EXACT, pressure: 0.4, subdivide: 0.05 };
    b.line(0, 0, 3, 0, style);
    let min = Infinity;
    let max = -Infinity;
    for (let v = 0; v < b.vertexCount; v += 1) {
      const ink = vertex(b, v).ink;
      min = Math.min(min, ink);
      max = Math.max(max, ink);
      expect(ink).toBeGreaterThanOrEqual(0.8 * 0.6 - 1e-6);
      expect(ink).toBeLessThanOrEqual(0.8 + 1e-6);
    }
    expect(max - min).toBeGreaterThan(0.05);
    // Le point partagé par deux segments a la même encre des deux côtés.
    expect(vertex(b, 2).ink).toBeCloseTo(vertex(b, VERTICES_PER_SEGMENT).ink, 6);
  });
});

describe('tremblé à graine', () => {
  function draw(seed: number): Float32Array {
    const b = new StrokeBatch(6000);
    b.seed = seed;
    b.line(0, 0, 3, 0, { ...WOBBLY, subdivide: 0.1 });
    return b.positions.slice(0, b.vertexCount * 3);
  }
  it('est déterministe à graine égale', () => {
    expect(draw(5)).toEqual(draw(5));
  });
  it('diffère à graine différente', () => {
    expect(draw(5)).not.toEqual(draw(6));
  });
  it('reste borné (tremblé + demi-largeur maximale)', () => {
    const positions = draw(9);
    const bound = WOBBLY.wobble + (WOBBLY.width / 2) * (1 + WOBBLY.widthJitter) + 1e-6;
    for (let v = 0; v < positions.length / 3; v += 1) {
      expect(Math.abs(positions[3 * v + 1] as number)).toBeLessThanOrEqual(bound);
    }
  });
  it('chaque trait d’un lot a son propre tremblé', () => {
    const b = new StrokeBatch(6000);
    b.line(0, 0, 3, 0, { ...WOBBLY, subdivide: 0.1 });
    const first = b.positions.slice(1, 2)[0];
    const count = b.vertexCount;
    b.line(0, 0, 3, 0, { ...WOBBLY, subdivide: 0.1 });
    expect(b.positions[count * 3 + 1]).not.toBe(first);
  });
});
