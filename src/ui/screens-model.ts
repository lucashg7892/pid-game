/**
 * Modèle de vue pur des écrans titre et menu (spec T-017 §4) : tous les textes dans la langue du
 * traducteur, sans DOM. `screens.ts` les écrit dans le document.
 */
import type { LevelEntry } from '../app';
import { otherLocale, type Locale, type PlainKey, type Translator } from '../i18n';

/** Clé i18n du titre de chaque niveau du catalogue (identifiant → clé). */
export const LEVEL_TITLE_KEYS: Readonly<Record<string, PlainKey>> = Object.freeze({
  level1: 'level1.title',
});

/** Textes de l'écran titre. */
export interface TitleView {
  /** Langue des textes. */
  readonly locale: Locale;
  /** Titre du jeu. */
  readonly title: string;
  /** Sous-titre. */
  readonly tagline: string;
  /** Bouton « Jouer ». */
  readonly play: string;
  /** Texte du bouton de langue (nom de l'autre langue, écrit dans cette langue). */
  readonly languageButton: string;
  /** Description accessible du bouton de langue. */
  readonly languageDescription: string;
  /** Langue du texte du bouton de langue (attribut `lang`). */
  readonly otherLocale: Locale;
  /** Ligne de copyright (identique à celle de `LICENSE`). */
  readonly copyright: string;
  /** Nom de la licence. */
  readonly license: string;
  /** Phrase annoncée à l'arrivée sur l'écran. */
  readonly announce: string;
}

/** Une entrée du menu. */
export interface MenuEntryView {
  /** Identifiant du niveau. */
  readonly id: string;
  /** Nom affiché. */
  readonly label: string;
  /** Faux : le bouton est désactivé. */
  readonly playable: boolean;
}

/** Textes du menu des niveaux. */
export interface MenuView {
  /** Langue des textes. */
  readonly locale: Locale;
  /** Titre du menu. */
  readonly title: string;
  /** Nom accessible de la liste. */
  readonly listLabel: string;
  /** Bouton de retour au titre. */
  readonly back: string;
  /** Niveaux, dans l'ordre du catalogue. */
  readonly entries: readonly MenuEntryView[];
  /** Phrase annoncée à l'arrivée sur l'écran. */
  readonly announce: string;
}

/**
 * Nom affiché d'un niveau.
 * @param id identifiant du niveau.
 * @param tr traducteur.
 * @returns le titre traduit ; l'identifiant lui-même si le niveau n'a pas de clé (défaut de
 * configuration, jamais d'exception pour un menu).
 */
export function levelLabel(id: string, tr: Translator): string {
  const key = Object.hasOwn(LEVEL_TITLE_KEYS, id) ? LEVEL_TITLE_KEYS[id] : undefined;
  return key === undefined ? id : tr.t(key);
}

/**
 * Textes de l'écran titre.
 * @param tr traducteur.
 */
export function buildTitleView(tr: Translator): TitleView {
  return {
    locale: tr.locale,
    title: tr.t('app.title'),
    tagline: tr.t('app.tagline'),
    play: tr.t('title.play'),
    languageButton: tr.t('app.language.switch'),
    languageDescription: tr.t('app.language.switchLabel'),
    otherLocale: otherLocale(tr.locale),
    copyright: tr.t('title.copyright'),
    license: tr.t('title.license'),
    announce: tr.t('menu.announce.title'),
  };
}

/**
 * Textes du menu des niveaux.
 * @param tr traducteur.
 * @param levels catalogue des niveaux.
 */
export function buildMenuView(tr: Translator, levels: readonly LevelEntry[]): MenuView {
  return {
    locale: tr.locale,
    title: tr.t('menu.title'),
    listLabel: tr.t('menu.listLabel'),
    back: tr.t('menu.back'),
    entries: levels.map((l) => ({ id: l.id, label: levelLabel(l.id, tr), playable: l.playable })),
    announce: tr.t('menu.announce.menu'),
  };
}
