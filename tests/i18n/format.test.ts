/** Formatage des nombres et des grandeurs (CA-4 de T-006). */
import { describe, expect, it } from 'vitest';
import { NBSP, NNBSP, formatNumber, formatQuantity } from '../../src/i18n';

describe('CA-4 : nombres', () => {
  it('séparateur décimal : 0,2 en FR, 0.2 en EN', () => {
    expect(formatNumber('fr', 0.2)).toBe('0,2');
    expect(formatNumber('en', 0.2)).toBe('0.2');
  });

  it('arrondi au plus proche, 2 décimales max par défaut, zéros finaux retirés', () => {
    expect(formatNumber('fr', 0.1962)).toBe('0,2');
    expect(formatNumber('fr', 0.4905)).toBe('0,49');
    expect(formatNumber('en', 0.327)).toBe('0.33');
    expect(formatNumber('en', 2.5)).toBe('2.5');
    expect(formatNumber('en', 3)).toBe('3');
  });

  it('décimales imposées (cote « e = 0,20 m » de la spec §6)', () => {
    const two = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    expect(formatNumber('fr', 0.1962, two)).toBe('0,20');
    expect(formatNumber('en', 0.1962, two)).toBe('0.20');
    expect(formatNumber('fr', 3, { minimumFractionDigits: 2 })).toBe('3,00');
    expect(formatNumber('en', 2.7766, { maximumFractionDigits: 3 })).toBe('2.777');
    expect(formatNumber('fr', 2499.6, { maximumFractionDigits: 0 })).toBe('2500');
  });

  it('groupement à partir de 5 chiffres entiers : U+202F en FR, virgule en EN', () => {
    expect(formatNumber('fr', 5000)).toBe('5000');
    expect(formatNumber('en', 8000)).toBe('8000');
    expect(formatNumber('fr', 12345.678)).toBe(`12${NNBSP}345,68`);
    expect(formatNumber('en', 12345.678)).toBe('12,345.68');
  });

  it('négatifs : vrai signe moins U+2212, jamais le trait d’union ASCII', () => {
    expect(formatNumber('fr', -1.5)).toBe('−1,5');
    expect(formatNumber('en', -0.33)).toBe('−0.33');
    expect(formatNumber('fr', -5000)).toBe('−5000');
    expect(formatNumber('en', -12345.6)).not.toContain('-');
    expect(formatNumber('fr', -1.5).codePointAt(0)).toBe(0x2212);
  });

  it('zéro négatif et négatif arrondi à zéro : « 0 », jamais « -0 »', () => {
    expect(formatNumber('fr', -0)).toBe('0');
    expect(formatNumber('en', -0)).toBe('0');
    expect(formatNumber('fr', -0.001)).toBe('0');
    expect(formatNumber('en', -0.004, { minimumFractionDigits: 2 })).toBe('0.00');
    expect(formatNumber('fr', 0)).toBe('0');
  });

  it('valeur non finie : RangeError (jamais « NaN » à l’écran)', () => {
    expect(() => formatNumber('fr', Number.NaN)).toThrow(RangeError);
    expect(() => formatNumber('en', Number.POSITIVE_INFINITY)).toThrow(/non fini/);
    expect(() => formatQuantity('fr', Number.NEGATIVE_INFINITY, 'm')).toThrow(RangeError);
  });

  it('options invalides : RangeError', () => {
    expect(() => formatNumber('fr', 1, { maximumFractionDigits: 21 })).toThrow(/0 à 20/);
    expect(() => formatNumber('fr', 1, { minimumFractionDigits: -1 })).toThrow(RangeError);
    expect(() => formatNumber('fr', 1, { minimumFractionDigits: 1.5 })).toThrow(RangeError);
    expect(() =>
      formatNumber('fr', 1, { minimumFractionDigits: 3, maximumFractionDigits: 1 }),
    ).toThrow(/< minimumFractionDigits/);
  });

  it('formateurs en cache : résultats stables sur appels répétés', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(formatNumber('fr', 0.25)).toBe('0,25');
      expect(formatNumber('en', 0.25)).toBe('0.25');
    }
  });
});

describe('CA-4 : grandeurs avec unité', () => {
  it('caractères documentés : U+00A0 et U+202F', () => {
    expect(NBSP).toBe('\u00A0');
    expect(NNBSP).toBe('\u202F');
  });

  it('FR : nombre, U+00A0, unité (m, N, N/m, s, %)', () => {
    expect(formatQuantity('fr', 0.2, 'm')).toBe('0,2\u00A0m');
    expect(formatQuantity('fr', 5000, 'N')).toBe('5000\u00A0N');
    expect(formatQuantity('fr', 2500, 'N/m')).toBe('2500\u00A0N/m');
    expect(formatQuantity('fr', 2.43, 's')).toBe('2,43\u00A0s');
    expect(formatQuantity('fr', 12.58, '%')).toBe('12,58\u00A0%');
  });

  it('EN : nombre, U+00A0, unité ; % collé au nombre', () => {
    expect(formatQuantity('en', 0.2, 'm')).toBe('0.2\u00A0m');
    expect(formatQuantity('en', 490.5, 'N')).toBe('490.5\u00A0N');
    expect(formatQuantity('en', 2500, 'N/m')).toBe('2500\u00A0N/m');
    expect(formatQuantity('en', 15, 's')).toBe('15\u00A0s');
    expect(formatQuantity('en', 12.58, '%')).toBe('12.58%');
  });

  it('négatifs, zéro négatif et décimales avec unité', () => {
    expect(formatQuantity('fr', -0.327, 'm')).toBe('\u22120,33\u00A0m');
    expect(formatQuantity('en', -0, 'm')).toBe('0\u00A0m');
    expect(formatQuantity('fr', -0.0001, 'm', { minimumFractionDigits: 2 })).toBe('0,00\u00A0m');
    expect(
      formatQuantity('fr', 0.1962, 'm', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ).toBe('0,20\u00A0m');
  });
});
