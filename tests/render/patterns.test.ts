import { describe, expect, it } from 'vitest';
import { SEGMENT_STRIDE, dashLine, hatchPolygon } from '../../src/render/patterns';

/** Point dans un polygone (règle pair-impair), avec tolérance sur le bord. */
function inside(poly: readonly number[], x: number, y: number, eps = 1e-9): boolean {
  const n = poly.length / 2;
  let odd = false;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = poly[2 * i] as number;
    const yi = poly[2 * i + 1] as number;
    const xj = poly[2 * j] as number;
    const yj = poly[2 * j + 1] as number;
    // Sur le bord ?
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    const within =
      x >= Math.min(xi, xj) - eps &&
      x <= Math.max(xi, xj) + eps &&
      y >= Math.min(yi, yj) - eps &&
      y <= Math.max(yi, yj) + eps;
    if (Math.abs(cross) <= eps * Math.hypot(xj - xi, yj - yi) && within) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

function hatch(poly: number[], angle: number, spacing: number, phase = 0) {
  const out = new Float64Array(4096);
  const count = hatchPolygon(
    poly,
    poly.length / 2,
    angle,
    spacing,
    phase,
    out,
    new Float64Array(64),
  );
  const segments: [number, number, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    const b = i * SEGMENT_STRIDE;
    segments.push([
      out[b] as number,
      out[b + 1] as number,
      out[b + 2] as number,
      out[b + 3] as number,
    ]);
  }
  return segments;
}

function expectInside(poly: number[], segments: [number, number, number, number][]): void {
  for (const [x0, y0, x1, y1] of segments) {
    for (let t = 0; t <= 1; t += 0.05) {
      expect(inside(poly, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1e-7)).toBe(true);
    }
  }
}

describe('hatchPolygon', () => {
  const square = [0, 0, 2, 0, 2, 1, 0, 1];
  it('toutes les hachures sont dans le polygone (rectangle)', () => {
    const segments = hatch(square, Math.PI / 4, 0.1);
    expect(segments.length).toBeGreaterThan(15);
    expectInside(square, segments);
  });
  it('hachures parallèles, au pas régulier, ancrées dans le repère monde', () => {
    const angle = Math.PI / 4;
    const spacing = 0.13;
    const segments = hatch(square, angle, spacing, 0.02);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const offsets = segments.map(([x0, y0, x1, y1]) => {
      const q0 = x0 * nx + y0 * ny;
      expect(x1 * nx + y1 * ny).toBeCloseTo(q0, 9);
      return q0;
    });
    for (const q of offsets) {
      const k = (q - 0.02) / spacing;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
    }
    for (let i = 1; i < offsets.length; i += 1) {
      expect((offsets[i] as number) - (offsets[i - 1] as number)).toBeCloseTo(spacing, 9);
    }
  });
  it('polygone concave (en L) : hachures à l’intérieur, coupées dans le creux', () => {
    const l = [0, 0, 2, 0, 2, 0.5, 0.5, 0.5, 0.5, 2, 0, 2];
    const segments = hatch(l, 0, 0.1);
    expectInside(l, segments);
    expect(segments.length).toBe(19);
  });
  it('polygone qui se recoupe (courbe qui traverse la consigne) : règle pair-impair', () => {
    // Zone entre une « courbe » en zigzag et la droite y = 1.
    const poly = [0, 1, 0, 0, 1, 2, 2, 0, 3, 1.5, 3, 1];
    const segments = hatch(poly, Math.PI / 2, 0.1);
    expectInside(poly, segments);
    expect(segments.length).toBeGreaterThan(10);
  });
  it('cas dégénérés : rien', () => {
    const out = new Float64Array(64);
    const scratch = new Float64Array(8);
    expect(hatchPolygon([0, 0, 1, 1], 2, 0, 0.1, 0, out, scratch)).toBe(0);
    expect(hatchPolygon(square, 4, 0, 0, 0, out, scratch)).toBe(0);
    expect(hatchPolygon(square, 4, 0, Number.NaN, 0, out, scratch)).toBe(0);
    expect(hatchPolygon([0, 0, Number.NaN, 0, 1, 1], 3, 0, 0.1, 0, out, scratch)).toBe(0);
    expect(hatchPolygon(square, 4, 0, 0.1, Number.NaN, out, scratch)).toBe(0);
  });
  it('s’arrête quand la sortie est pleine', () => {
    const out = new Float64Array(3 * SEGMENT_STRIDE);
    expect(hatchPolygon(square, 4, 0, 0.01, 0, out, new Float64Array(8))).toBe(3);
  });
});

describe('dashLine', () => {
  it('tirets et vides aux longueurs demandées, dernier tiret tronqué', () => {
    const out = new Float64Array(400);
    const count = dashLine(0, 0, 1, 0, 0.12, 0.08, out);
    expect(count).toBe(5);
    for (let i = 0; i < count; i += 1) {
      const x0 = out[4 * i] as number;
      const x1 = out[4 * i + 2] as number;
      expect(x0).toBeCloseTo(i * 0.2, 12);
      expect(x1 - x0).toBeCloseTo(i < 4 ? 0.12 : Math.min(0.12, 1 - 0.8), 12);
      if (i > 0) expect(x0 - (out[4 * i - 2] as number)).toBeCloseTo(0.08, 12);
    }
  });
  it('suit la direction du segment (de droite à gauche)', () => {
    const out = new Float64Array(400);
    const count = dashLine(4, 3, 0, 3, 0.12, 0.08, out);
    expect(count).toBe(20);
    expect(out[0]).toBe(4);
    expect(out[2]).toBeCloseTo(3.88, 12);
    expect(out[1]).toBe(3);
  });
  it('cas dégénérés et sortie pleine', () => {
    const out = new Float64Array(8);
    expect(dashLine(0, 0, 0, 0, 0.1, 0.1, out)).toBe(0);
    expect(dashLine(0, 0, 1, 0, 0, 0.1, out)).toBe(0);
    expect(dashLine(0, 0, 1, 0, 0.1, -1, out)).toBe(0);
    expect(dashLine(0, 0, 1, 0, 0.1, 0.1, out)).toBe(2);
  });
});
