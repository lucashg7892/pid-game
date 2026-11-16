/**
 * Contenu des catalogues FR/EN (CA-1, CA-2 de T-006) : parité stricte, paramètres, clés de la
 * spec T-001 §6, typographie.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CATALOGS,
  MESSAGE_PARAMS,
  NBSP,
  NNBSP,
  SUPPORTED_LOCALES,
  isLocale,
  isMessageKey,
  matchLocale,
  otherLocale,
  placeholdersOf,
  type MessageKey,
} from '../../src/i18n';
import { LEVEL2_ARRIVAL_TOLERANCE, TRIP_MAX_STEPS } from '../../src/game';
import { SIM_DT } from '../../src/sim';

const FR = CATALOGS.fr;
const EN = CATALOGS.en;

/**
 * Seules clés dont le texte est identique en français et en anglais, avec la raison.
 * Toute autre égalité FR = EN est suspecte (texte oublié en VO).
 */
const IDENTICAL_ALLOWED: Readonly<Record<string, string>> = {
  'controls.pause': '« Pause » est le mot usuel des deux langues pour ce bouton.',
  'controls.action': 'la spec §6 nomme le bouton tactile « Action » ; même mot en anglais.',
  'controls.menu': '« Menu » est le mot usuel des deux langues pour ce bouton.',
  'level1.dimension': 'cote mathématique « e = … m » : notation identique, seul {e} varie.',
  'app.title': 'titre du jeu « Huygens’s world » (décision D15), nom propre non traduit.',
  'hud.gauge.max': 'notation « 5000 N max » : nombre et unité SI identiques, seul {n} varie.',
  'hud.ki.tag': 'notation « Kp = … · Ki = … » : symboles identiques, seuls {kp} et {ki} varient.',
  'hud.kp.value': 'notation « Kp = … N/m » : symbole et unité SI identiques, seul {kp} varie.',
  'pupitre.courbes.temps': 'notation « t = … s » : symbole et unité SI identiques, seul {t} varie.',
  'board.value.ki':
    'notation « Ki = … N/(m·s) » : symbole et unité SI identiques, seul {ki} varie.',
  'title.copyright':
    'ligne de copyright du fichier LICENSE (titulaire et année), notice légale non traduite.',
};

/** Clés imposées par la spec T-001 §6 (textes clés). */
const SPEC_KEYS = [
  'level1.goal',
  'level1.kp.help',
  'level1.fail.noLift',
  'level1.fail.step',
  'level1.fail.bonk',
  'level1.saturation',
  'level1.win',
] as const;

/** Préfixes autorisés pour l'organisation des clés. */
const PREFIXES = [
  'app.',
  'title.',
  'menu.',
  'level1.',
  'level2.',
  'board.',
  'hud.',
  'pupitre.',
  'controls.',
  'a11y.',
  'fallback.',
];

function readRaw(locale: string): string {
  return readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8');
}

function sortedKeys(catalog: object): string[] {
  return Object.keys(catalog).sort();
}

describe('catalogues : structure des fichiers JSON', () => {
  it.each(SUPPORTED_LOCALES)('%s.json : objet plat de chaînes, sans clé dupliquée, en LF', (l) => {
    const raw = readRaw(l);
    expect(raw).not.toContain('\r');
    const parsed: unknown = JSON.parse(raw);
    expect(typeof parsed).toBe('object');
    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [, value] of entries) {
      expect(typeof value).toBe('string');
    }
    // JSON.parse garde silencieusement la dernière valeur d'une clé dupliquée : on compte
    // les clés dans le texte brut (une par ligne, format Prettier).
    const rawKeys = [...raw.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    expect(rawKeys.length).toBe(entries.length);
    expect(new Set(rawKeys).size).toBe(rawKeys.length);
  });

  it('clés en points, segments en camelCase, préfixe connu', () => {
    for (const key of Object.keys(FR)) {
      expect(key, key).toMatch(/^[a-z][a-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/);
      expect(
        PREFIXES.some((p) => key.startsWith(p)),
        key,
      ).toBe(true);
    }
  });

  it("aucune clé n'est le préfixe d'une autre (conversion future en JSON imbriqué possible)", () => {
    const keys = Object.keys(FR);
    for (const a of keys) {
      for (const b of keys) {
        expect(b.startsWith(`${a}.`), `${a} / ${b}`).toBe(false);
      }
    }
  });
});

describe('CA-1 : parité stricte FR/EN', () => {
  it('mêmes clés', () => {
    expect(sortedKeys(EN)).toEqual(sortedKeys(FR));
  });

  it('aucune valeur vide ni réduite à des espaces', () => {
    for (const l of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(CATALOGS[l])) {
        expect(value.trim(), `${l}:${key}`).not.toBe('');
        expect(value, `${l}:${key}`).toBe(value.trim());
      }
    }
  });

  it('mêmes paramètres {…} dans les deux langues, gabarits bien formés', () => {
    for (const key of Object.keys(FR) as MessageKey[]) {
      expect([...placeholdersOf(EN[key])].sort(), key).toEqual([...placeholdersOf(FR[key])].sort());
    }
  });

  it('valeurs FR ≠ EN, sauf liste blanche justifiée (et la liste blanche est exacte)', () => {
    const identical = (Object.keys(FR) as MessageKey[]).filter((k) => FR[k] === EN[k]).sort();
    expect(identical).toEqual(Object.keys(IDENTICAL_ALLOWED).sort());
    for (const reason of Object.values(IDENTICAL_ALLOWED)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('MESSAGE_PARAMS (typage des appels) correspond exactement aux gabarits', () => {
    const declared = MESSAGE_PARAMS as Readonly<Record<string, readonly string[]>>;
    for (const key of Object.keys(FR) as MessageKey[]) {
      const expected = [...placeholdersOf(FR[key])].sort();
      const listed = Object.hasOwn(declared, key) ? [...(declared[key] ?? [])].sort() : [];
      expect(listed, key).toEqual(expected);
    }
    for (const key of Object.keys(declared)) {
      expect(isMessageKey(key), key).toBe(true);
    }
  });
});

describe('CA-2 : clés de la spec T-001 §6', () => {
  it.each(SPEC_KEYS)('%s présente en FR et en EN', (key) => {
    expect(isMessageKey(key)).toBe(true);
    expect(Object.hasOwn(FR, key)).toBe(true);
    expect(Object.hasOwn(EN, key)).toBe(true);
  });

  it('level1.fail.step garde le paramètre {e} de la spec ; les autres textes de §6 sans paramètre', () => {
    expect(placeholdersOf(FR['level1.fail.step'])).toEqual(['e']);
    for (const key of SPEC_KEYS.filter((k) => k !== 'level1.fail.step')) {
      expect(placeholdersOf(FR[key]), key).toEqual([]);
    }
  });

  it('les nombres physiques cités sont ceux de la spec §5', () => {
    // m·g = 50 kg × 9,81 m/s² = 490,5 N ; Umax = 5000 N ; r = 3 m ; marche 0,5 m ; poutre 3,3626 m (3,36 m dans le texte).
    expect(50 * 9.81).toBeCloseTo(490.5, 10);
    expect(FR['level1.fail.noLift']).toContain(`490,5${NBSP}N`);
    expect(EN['level1.fail.noLift']).toContain(`490.5${NBSP}N`);
    expect(FR['level1.fail.noLift']).toContain(`3${NBSP}m`);
    expect(FR['level1.saturation']).toContain(`5000${NBSP}N`);
    expect(EN['level1.saturation']).toContain(`5000${NBSP}N`);
    expect(FR['level1.fail.step']).toContain(`(0,5${NBSP}m au plus)`);
    expect(EN['level1.fail.step']).toContain(`(0.5${NBSP}m at most)`);
    expect(FR['level1.fail.bonk']).toContain(`3,36${NBSP}m`);
    expect(EN['level1.fail.bonk']).toContain(`3.36${NBSP}m`);
    expect(FR['level1.win']).toContain('m·g/Kp');
    expect(EN['level1.win']).toContain('m·g/Kp');
  });

  it('niveau 2 : durée (10 s) et tolérance (0,1 m) citées = constantes du jeu (T-022)', () => {
    expect(TRIP_MAX_STEPS * SIM_DT).toBeCloseTo(10, 12);
    expect(LEVEL2_ARRIVAL_TOLERANCE).toBe(0.1);
    for (const key of ['level2.fail.step', 'hud.status.fail.stepKi'] as const) {
      expect(FR[key], key).toContain(`10${NBSP}s`);
      expect(EN[key], key).toContain(`10${NBSP}s`);
      expect(FR[key], key).toContain(`0,1${NBSP}m`);
      expect(EN[key], key).toContain(`0.1${NBSP}m`);
      expect(FR[key], key).not.toContain(`0,5${NBSP}m`);
      expect(EN[key], key).not.toContain(`0.5${NBSP}m`);
    }
    for (const key of ['level2.fail.slow', 'hud.status.fail.slow'] as const) {
      expect(FR[key], key).toContain(`10${NBSP}s`);
      expect(EN[key], key).toContain(`10${NBSP}s`);
    }
    expect(FR['level2.goal']).toContain(`0,1${NBSP}m`);
    expect(EN['level2.goal']).toContain(`0.1${NBSP}m`);
    for (const l of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(CATALOGS[l])) {
        expect(value, `${l}:${key}`).not.toContain(`6${NBSP}s`);
      }
    }
  });
});

describe('textes corrigés en T-029 (B-06, B-08)', () => {
  it('B-06 : la bulle anglaise du niveau 1 cite l’ascenseur et la hauteur de 3 m, comme la française', () => {
    expect(FR['level1.goal']).toContain(`3${NBSP}m`);
    expect(EN['level1.goal']).toBe(
      `To get across, ride the lift up to the ledge on the far side, 3${NBSP}m higher. The farther the cabin is from that height, the harder the motor pulls.`,
    );
    expect(EN['level1.goal']).toContain('lift');
    expect(EN['level1.goal']).toContain(`3${NBSP}m`);
  });

  it('B-08 : l’aide d’interaction cite le lancement, au clavier et au tactile, dans les deux langues', () => {
    expect(FR['controls.help.interact']).toMatch(/puis lancer$/);
    expect(EN['controls.help.interact']).toMatch(/then launch$/);
    for (const key of ['controls.help.touch', 'controls.help.touchKi'] as const) {
      expect(FR[key], key).toContain('et lancer');
      expect(EN[key], key).toContain('and launch');
    }
  });
});

describe('typographie', () => {
  it('apostrophe typographique U+2019 partout, jamais U+0027 ; points de suspension U+2026', () => {
    for (const l of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(CATALOGS[l])) {
        expect(value, `${l}:${key}`).not.toContain("'");
        expect(value, `${l}:${key}`).not.toContain('...');
        expect(value, `${l}:${key}`).not.toMatch(/ {2}/);
      }
    }
  });

  it('français : U+202F avant « ; ! ? », U+00A0 avant « : »', () => {
    for (const [key, value] of Object.entries(FR)) {
      for (const match of value.matchAll(/[;!?:]/g)) {
        const before = value.charAt(match.index - 1);
        const expected = match[0] === ':' ? NBSP : NNBSP;
        expect(before, `${key} : « ${match[0]} » en position ${String(match.index)}`).toBe(
          expected,
        );
      }
    }
  });

  it('anglais : aucune espace avant « : ; ! ? »', () => {
    for (const [key, value] of Object.entries(EN)) {
      expect(value, key).not.toMatch(/[\s\u00A0\u202F][;!?:]/);
    }
  });

  it('nombre suivi d’une unité : séparé par U+00A0 dans les deux langues', () => {
    for (const l of SUPPORTED_LOCALES) {
      for (const [key, value] of Object.entries(CATALOGS[l])) {
        expect(value, `${l}:${key}`).not.toMatch(/(\d|\})[ \u202F](m|N|s)\b/);
      }
    }
  });
});

describe('fonctions utilitaires des catalogues', () => {
  it('isLocale, otherLocale, isMessageKey', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('FR')).toBe(false);
    expect(isLocale('de')).toBe(false);
    expect(otherLocale('fr')).toBe('en');
    expect(otherLocale('en')).toBe('fr');
    expect(isMessageKey('level1.goal')).toBe(true);
    expect(isMessageKey('level1')).toBe(false);
    expect(isMessageKey('toString')).toBe(false);
  });

  it('matchLocale : sous-étiquette principale exacte', () => {
    expect(matchLocale('fr')).toBe('fr');
    expect(matchLocale(' FR-ca ')).toBe('fr');
    expect(matchLocale('en_GB')).toBe('en');
    expect(matchLocale('frr')).toBeUndefined();
    expect(matchLocale('de-CH')).toBeUndefined();
    expect(matchLocale('')).toBeUndefined();
  });
});
