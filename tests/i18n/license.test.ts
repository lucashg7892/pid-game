/**
 * Mention de copyright de l'écran titre (spec T-017 §5) : elle doit rester celle du fichier
 * `LICENSE` (année, titulaire, nom de la licence).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../../src/i18n';

const FR = CATALOGS.fr;
const EN = CATALOGS.en;

const LICENSE = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8').replaceAll(
  '\r\n',
  '\n',
);
const COPYRIGHT_LINES = LICENSE.split('\n').filter((l) => /^Copyright \(c\) \d{4} \S/.test(l));
const FIRST_LINE = LICENSE.split('\n')[0] ?? '';

describe('mention de copyright et LICENSE', () => {
  it('LICENSE contient exactement une ligne de copyright, avec année et titulaire', () => {
    expect(COPYRIGHT_LINES).toHaveLength(1);
    expect(COPYRIGHT_LINES[0]).toMatch(/^Copyright \(c\) (\d{4}) (\S.*)$/);
  });

  it('title.copyright est la ligne de LICENSE, en français comme en anglais', () => {
    expect(FR['title.copyright']).toBe(COPYRIGHT_LINES[0]);
    expect(EN['title.copyright']).toBe(COPYRIGHT_LINES[0]);
  });

  it('année et titulaire des catalogues sont ceux de LICENSE', () => {
    const match = /^Copyright \(c\) (\d{4}) (\S.*)$/.exec(COPYRIGHT_LINES[0] ?? '');
    expect(match).not.toBeNull();
    for (const text of [FR['title.copyright'], EN['title.copyright']]) {
      expect(text).toContain(match?.[1] ?? '?');
      expect(text).toContain(match?.[2] ?? '?');
    }
  });

  it('title.license : première ligne de LICENSE en anglais, licence MIT en français', () => {
    expect(EN['title.license']).toBe(FIRST_LINE);
    expect(FR['title.license']).toContain('MIT');
  });

  it('aucune autre clé ne porte de notice de copyright', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(catalog)) {
        if (key === 'title.copyright') {
          continue;
        }
        expect(value, `${locale}:${key}`).not.toMatch(/copyright|©/i);
      }
    }
  });
});
