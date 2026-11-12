/** Traducteur : traduction, changement de langue, abonnés (CA-3, CA-6 de T-006). */
import { describe, expect, it, vi } from 'vitest';
import {
  CATALOGS,
  I18nError,
  SUPPORTED_LOCALES,
  createTranslator,
  type Catalog,
  type Locale,
  type MessageKey,
  type Translator,
} from '../../src/i18n';

/** Fabrique des paramètres textuels pour chaque `{nom}` d'un gabarit. */
function paramsFor(template: string): Record<string, string> | undefined {
  const names = [...template.matchAll(/\{([A-Za-z_]\w*)\}/g)].map((m) => m[1] ?? '');
  return names.length === 0 ? undefined : Object.fromEntries(names.map((n) => [n, '1']));
}

/** Appel de `t` sans le contrôle de type, pour vérifier les gardes d'exécution. */
function untypedT(tr: Translator, key: string, params?: Record<string, string>): string {
  const t = tr.t.bind(tr) as unknown as (k: string, p?: Record<string, string>) => string;
  return t(key, params);
}

describe('traduction', () => {
  it('texte de la langue courante', () => {
    const tr = createTranslator('fr');
    expect(tr.locale).toBe('fr');
    expect(tr.t('controls.launch')).toBe('Lancer');
    tr.setLocale('en');
    expect(tr.t('controls.launch')).toBe('Launch');
  });

  it('paramètres remplacés, valeurs formatées par le traducteur', () => {
    const tr = createTranslator('fr');
    expect(tr.t('level1.fail.step', { e: tr.formatNumber(0.327) })).toMatch(
      /^Il manque 0,33\u00A0m\u00A0:/,
    );
    const e = tr.formatNumber(0.1962, { minimumFractionDigits: 2 });
    expect(tr.t('level1.dimension', { e })).toBe('e = 0,20\u00A0m');
    tr.setLocale('en');
    expect(tr.t('level1.fail.step', { e: tr.formatNumber(0.327) })).toMatch(/^0\.33\u00A0m short:/);
    expect(tr.formatQuantity(2500, 'N/m')).toBe('2500\u00A0N/m');
  });

  it('chaque clé de chaque langue se traduit, avec ses paramètres, sans accolade résiduelle', () => {
    for (const l of SUPPORTED_LOCALES) {
      const tr = createTranslator(l);
      for (const key of Object.keys(CATALOGS[l]) as MessageKey[]) {
        const text = untypedT(tr, key, paramsFor(CATALOGS[l][key]));
        expect(text, `${l}:${key}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('paramètre manquant ou en trop à l’exécution : I18nError citant la clé', () => {
    const tr = createTranslator('en');
    expect(() => untypedT(tr, 'level1.fail.step', {})).toThrow(
      /paramètre manquant « e » \(clé « level1\.fail\.step »\)/,
    );
    expect(() => untypedT(tr, 'level1.fail.step')).toThrow(I18nError);
    expect(() => untypedT(tr, 'level1.goal', { e: '1' })).toThrow(/en trop : e/);
  });

  it('clé inconnue à l’exécution (appel non typé) : I18nError', () => {
    const tr = createTranslator('fr');
    expect(() => untypedT(tr, 'cle.inexistante')).toThrow(I18nError);
    expect(() => untypedT(tr, 'toString')).toThrow(/clé inconnue « toString »/);
  });

  it('catalogues injectés (tests) utilisés à la place des locales', () => {
    const fake: Readonly<Record<Locale, Catalog>> = {
      fr: { ...CATALOGS.fr, 'controls.launch': 'Go FR' },
      en: CATALOGS.en,
    };
    expect(createTranslator('fr', fake).t('controls.launch')).toBe('Go FR');
  });

  it('langue non prise en charge (appel non typé) : RangeError', () => {
    expect(() => createTranslator('de' as Locale)).toThrow(RangeError);
    const tr = createTranslator('fr');
    expect(() => tr.setLocale('de' as Locale)).toThrow(/non prise en charge : de/);
    expect(tr.locale).toBe('fr');
  });
});

describe('CA-6 : changement de langue et abonnés', () => {
  it('abonné notifié une fois par changement, avec nouvelle et ancienne langue', () => {
    const tr = createTranslator('fr');
    const listener = vi.fn();
    tr.subscribe(listener);
    expect(tr.setLocale('en')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('en', 'fr');
    expect(tr.locale).toBe('en');
    expect(tr.setLocale('fr')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith('fr', 'en');
  });

  it('aucune notification si la langue ne change pas', () => {
    const tr = createTranslator('en');
    const listener = vi.fn();
    tr.subscribe(listener);
    expect(tr.setLocale('en')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('la langue est déjà changée quand l’abonné est appelé (il peut retraduire)', () => {
    const tr = createTranslator('fr');
    const seen: string[] = [];
    tr.subscribe(() => seen.push(tr.t('controls.launch')));
    tr.setLocale('en');
    expect(seen).toEqual(['Launch']);
  });

  it('désabonnement : plus de notification ; idempotent', () => {
    const tr = createTranslator('fr');
    const a = vi.fn();
    const b = vi.fn();
    const offA = tr.subscribe(a);
    tr.subscribe(b);
    offA();
    offA();
    tr.setLocale('en');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('même fonction abonnée deux fois : notifiée une seule fois', () => {
    const tr = createTranslator('fr');
    const listener = vi.fn();
    tr.subscribe(listener);
    tr.subscribe(listener);
    tr.setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('désabonnement pendant une notification : effet à la notification suivante', () => {
    const tr = createTranslator('fr');
    const late = vi.fn();
    const off: { late?: () => void } = {};
    tr.subscribe(() => off.late?.());
    off.late = tr.subscribe(late);
    tr.setLocale('en');
    expect(late).toHaveBeenCalledTimes(1);
    tr.setLocale('fr');
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('abonné en erreur : les autres sont notifiés, AggregateError ensuite, langue changée', () => {
    const tr = createTranslator('fr');
    const after = vi.fn();
    tr.subscribe(() => {
      throw new Error('boum');
    });
    tr.subscribe(after);
    expect(() => tr.setLocale('en')).toThrow(AggregateError);
    expect(after).toHaveBeenCalledTimes(1);
    expect(tr.locale).toBe('en');
  });

  it('formatage suivant la langue courante', () => {
    const tr = createTranslator('fr');
    expect(tr.formatNumber(0.2)).toBe('0,2');
    expect(tr.formatQuantity(12.5, '%')).toBe('12,5\u00A0%');
    tr.setLocale('en');
    expect(tr.formatNumber(0.2)).toBe('0.2');
    expect(tr.formatQuantity(12.5, '%')).toBe('12.5%');
  });
});
