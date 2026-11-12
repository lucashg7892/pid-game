/** Interpolation stricte `{nom}` (CA-3 de T-006). */
import { describe, expect, it } from 'vitest';
import { I18nError, interpolate, parseTemplate, placeholdersOf } from '../../src/i18n';

describe('CA-3 : interpolation', () => {
  it('remplace chaque paramètre, y compris répété', () => {
    expect(interpolate('Il manque {e} m', { e: '0,33' })).toBe('Il manque 0,33 m');
    expect(interpolate('{a}+{b}={a}{b}', { a: '1', b: '2' })).toBe('1+2=12');
    expect(interpolate('{x}', { x: '' })).toBe('');
  });

  it('gabarit sans paramètre : renvoyé tel quel (params omis ou vide)', () => {
    expect(interpolate('Lancer')).toBe('Lancer');
    expect(interpolate('Lancer', {})).toBe('Lancer');
    expect(interpolate('')).toBe('');
  });

  it('la valeur insérée n’est pas réinterprétée (pas de double substitution)', () => {
    expect(interpolate('{a}', { a: '{b}' })).toBe('{b}');
  });

  it('paramètre manquant : I18nError explicite, citant le nom et la clé', () => {
    expect(() => interpolate('Il manque {e} m', {})).toThrow(I18nError);
    expect(() => interpolate('Il manque {e} m', {}, 'level1.fail.step')).toThrow(
      /paramètre manquant « e » \(clé « level1\.fail\.step »\)/,
    );
    expect(() => interpolate('Il manque {e} m')).toThrow(/manquant « e »/);
  });

  it('une propriété héritée (prototype) ne compte pas comme paramètre fourni', () => {
    expect(() => interpolate('{toString}', {})).toThrow(/manquant « toString »/);
  });

  it('paramètre en trop : I18nError (décision : strict, attrape les fautes de frappe)', () => {
    expect(() => interpolate('{e} m', { e: '1', E: '1' })).toThrow(/en trop : E/);
    expect(() => interpolate('Lancer', { e: '1' }, 'controls.launch')).toThrow(
      /paramètre\(s\) en trop : e \(clé « controls\.launch »\)/,
    );
  });

  it('valeur non textuelle (appel non typé) : I18nError, le nombre doit être formaté', () => {
    const raw = { e: 0.2 } as unknown as Record<string, string>;
    expect(() => interpolate('{e}', raw)).toThrow(/chaîne déjà formatée/);
  });

  it('accolades littérales : {{ → {, }} → }', () => {
    expect(interpolate('{{e}}')).toBe('{e}');
    expect(interpolate('{{{e}}}', { e: 'x' })).toBe('{x}');
    expect(interpolate('a }} b {{', {})).toBe('a } b {');
    expect(placeholdersOf('{{e}}')).toEqual([]);
  });

  it('gabarit mal formé : I18nError', () => {
    expect(() => parseTemplate('a { b')).toThrow(/non fermée à la position 2/);
    expect(() => parseTemplate('a } b')).toThrow(/fermante isolée à la position 2/);
    expect(() => parseTemplate('{}')).toThrow(/nom de paramètre invalide « {} »/);
    expect(() => parseTemplate('{1e}')).toThrow(I18nError);
    expect(() => parseTemplate('{ e }', 'k')).toThrow(/invalide « { e } » \(clé « k »\)/);
  });

  it('I18nError : nom de classe et héritage', () => {
    const error = new I18nError('x');
    expect(error.name).toBe('I18nError');
    expect(error).toBeInstanceOf(Error);
  });

  it('parseTemplate : découpage texte / paramètres', () => {
    expect(parseTemplate('e = {e} m')).toEqual([
      { kind: 'text', value: 'e = ' },
      { kind: 'param', name: 'e' },
      { kind: 'text', value: ' m' },
    ]);
    expect(parseTemplate('{a}{b}')).toEqual([
      { kind: 'param', name: 'a' },
      { kind: 'param', name: 'b' },
    ]);
    expect(placeholdersOf('{y} {r} {e} {y}')).toEqual(['y', 'r', 'e']);
  });
});
