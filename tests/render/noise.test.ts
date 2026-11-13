import { describe, expect, it } from 'vitest';
import { boilSeed, hash01, mixSeed, valueNoise } from '../../src/render/noise';

describe('hash01', () => {
  it('est déterministe et dans [0, 1)', () => {
    for (let i = -500; i < 500; i += 1) {
      const v = hash01(7, i);
      expect(v).toBe(hash01(7, i));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('dépend de la graine et de l’indice', () => {
    expect(hash01(1, 5)).not.toBe(hash01(2, 5));
    expect(hash01(1, 5)).not.toBe(hash01(1, 6));
  });
  it('se répartit à peu près uniformément', () => {
    let sum = 0;
    for (let i = 0; i < 10000; i += 1) sum += hash01(3, i);
    expect(sum / 10000).toBeGreaterThan(0.48);
    expect(sum / 10000).toBeLessThan(0.52);
  });
});

describe('valueNoise (tremblé)', () => {
  it('est borné dans [−1, 1] et déterministe à graine égale', () => {
    for (let x = -20; x < 20; x += 0.037) {
      const v = valueNoise(11, x);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(v).toBe(valueNoise(11, x));
    }
  });
  it('diffère à graine différente', () => {
    let differences = 0;
    for (let x = 0; x < 10; x += 0.1) {
      if (valueNoise(1, x) !== valueNoise(2, x)) differences += 1;
    }
    expect(differences).toBeGreaterThan(90);
  });
  it('est continu', () => {
    for (let x = 0; x < 10; x += 0.01) {
      expect(Math.abs(valueNoise(4, x + 1e-6) - valueNoise(4, x))).toBeLessThan(1e-4);
    }
  });
});

describe('mixSeed', () => {
  it('est déterministe, entier 32 bits et sensible à l’ordre', () => {
    expect(mixSeed(3, 4)).toBe(mixSeed(3, 4));
    expect(mixSeed(3, 4)).not.toBe(mixSeed(4, 3));
    expect(Number.isInteger(mixSeed(1e12, -5))).toBe(true);
  });
});

describe('boilSeed', () => {
  it('change 8 fois par seconde et boucle', () => {
    expect(boilSeed(0, 8, 64, false)).toBe(0);
    expect(boilSeed(0.124, 8, 64, false)).toBe(0);
    expect(boilSeed(0.126, 8, 64, false)).toBe(1);
    expect(boilSeed(1, 8, 64, false)).toBe(8);
    expect(boilSeed(8, 8, 64, false)).toBe(0);
  });
  it('est figé avec prefers-reduced-motion et pour un temps invalide', () => {
    expect(boilSeed(3.7, 8, 64, true)).toBe(0);
    expect(boilSeed(-1, 8, 64, false)).toBe(0);
    expect(boilSeed(Number.NaN, 8, 64, false)).toBe(0);
  });
});
