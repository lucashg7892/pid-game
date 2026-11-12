/** Choix de la langue initiale (CA-5 de T-006, spec T-001 §8). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, detectLocale } from '../../src/i18n';

describe('CA-5 : choix de la langue initiale', () => {
  it('?lang=fr et ?lang=en l’emportent sur le navigateur', () => {
    expect(detectLocale('?lang=fr', ['en-US'])).toBe('fr');
    expect(detectLocale('?lang=en', ['fr-FR', 'fr'])).toBe('en');
  });

  it('?lang= : casse et région de la valeur ignorées, « ? » initial facultatif', () => {
    expect(detectLocale('?lang=FR', [])).toBe('fr');
    expect(detectLocale('?lang=En-gb', ['fr'])).toBe('en');
    expect(detectLocale('?lang=fr-BE', [])).toBe('fr');
    expect(detectLocale('lang=fr', [])).toBe('fr');
    expect(detectLocale('?renderer=webgl&lang=en', ['fr'])).toBe('en');
  });

  it('le nom du paramètre, lui, est sensible à la casse (?LANG= ignoré)', () => {
    expect(detectLocale('?LANG=fr', [])).toBe('en');
  });

  it('?lang=xx, vide ou absent : ignoré, on passe aux langues du navigateur', () => {
    expect(detectLocale('?lang=xx', ['fr-CA'])).toBe('fr');
    expect(detectLocale('?lang=xx', [])).toBe('en');
    expect(detectLocale('?lang=', ['fr'])).toBe('fr');
    expect(detectLocale('?lang=frr', ['fr'])).toBe('fr');
    expect(detectLocale('', ['fr'])).toBe('fr');
  });

  it('premier paramètre lang retenu s’il est répété', () => {
    expect(detectLocale('?lang=en&lang=fr', [])).toBe('en');
  });

  it('sans paramètre : première langue préférée prise en charge', () => {
    expect(detectLocale('', ['fr-CA', 'en'])).toBe('fr');
    expect(detectLocale('', ['de', 'fr'])).toBe('fr');
    expect(detectLocale('', ['de', 'en', 'fr'])).toBe('en');
    expect(detectLocale('', ['en-US', 'fr'])).toBe('en');
    expect(detectLocale('', ['FR-ca'])).toBe('fr');
    expect(detectLocale('?renderer=webgl', ['fr'])).toBe('fr');
  });

  it('aucune langue reconnue : anglais', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(detectLocale('', [])).toBe('en');
    expect(detectLocale('', ['de', 'es-ES'])).toBe('en');
    expect(detectLocale('', ['frr'])).toBe('en'); // frison septentrional, pas du français
    expect(detectLocale('', [''])).toBe('en');
  });
});
