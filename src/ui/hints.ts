/**
 * Bandeau d'aide contextuel (T-010) : quelle action est possible maintenant, et avec quelle
 * touche. Fonctions pures : le choix du bandeau dépend de l'instantané, son contenu de la langue.
 *
 * Un bandeau est une liste d'éléments ; un élément est une suite de morceaux « touche » (affichés
 * en `<kbd>`) et « texte ». La forme « touches : action » vient de la clé `hud.hint.item`
 * (« {keys} : {action} » en français avec U+00A0, « {keys}: {action} » en anglais).
 */
import type { LevelId, LevelSnapshot } from '../game';
import { CATALOGS, parseTemplate, type PlainKey, type Translator } from '../i18n';

/**
 * Bandeau à afficher :
 * - `use` : en approche, n'importe où sur le quai (E ouvre le réglage, D31) ;
 * - `tune` : réglage ouvert ;
 * - `skip` : embarquement ou sortie (animation que la touche de lancement passe) ;
 * - `trip` : trajet en cours ;
 * - `outcome` : issue affichée ;
 * - `paused` : jeu en pause ;
 * - `help` : aide des commandes ouverte ;
 * - `board` : tableau d'école ouvert ;
 * - `pupitre` : pupitre de contrôle ouvert en lecture seule.
 */
export type HintId =
  'use' | 'tune' | 'skip' | 'trip' | 'outcome' | 'paused' | 'help' | 'board' | 'pupitre';

/** Morceau d'un élément du bandeau. */
export interface HintSegment {
  /** `key` : touche de clavier (`<kbd>`) ; `text` : texte courant. */
  readonly kind: 'key' | 'text';
  /** Texte affiché. */
  readonly text: string;
}

/** Élément du bandeau : suite de morceaux. */
export type HintItem = readonly HintSegment[];

/** Contenu d'un bandeau : éléments séparés à l'affichage par « · ». */
export type HintLine = readonly HintItem[];

/** Symboles de touches identiques dans toutes les langues (dessins de touches, pas du texte). */
export const KEY_SYMBOLS = Object.freeze({
  use: 'E',
  restart: 'R',
  plus: '+',
  minus: '−',
});

/** Séparateur entre deux touches équivalentes (« → / D »). */
export const KEY_SEPARATOR = ' / ';

/**
 * Choisit le bandeau d'après l'instantané (fonction pure).
 * @param s instantané du niveau.
 * @param helpOpen vrai si l'aide des commandes est ouverte.
 * @param boardOpen vrai si le tableau d'école est ouvert.
 * @param pupitreReadOnly vrai si le pupitre est ouvert en lecture seule.
 */
export function chooseHint(
  s: Readonly<LevelSnapshot>,
  helpOpen: boolean,
  boardOpen = false,
  pupitreReadOnly = false,
): HintId {
  if (boardOpen) {
    return 'board';
  }
  if (helpOpen) {
    return 'help';
  }
  if (pupitreReadOnly) {
    return 'pupitre';
  }
  switch (s.phase) {
    case 'paused':
      return 'paused';
    case 'approach':
      return 'use';
    case 'tuning':
      return 'tune';
    case 'boarding':
    case 'exit':
      return 'skip';
    case 'trip':
      return 'trip';
    case 'outcome':
      return 'outcome';
  }
}

/** Touche dessinée. */
function key(text: string): HintSegment {
  return { kind: 'key', text };
}

/** Texte courant. */
function text(value: string): HintSegment {
  return { kind: 'text', text: value };
}

/**
 * Élément « touches : action » d'après le gabarit `hud.hint.item` de la langue courante.
 * @param tr traducteur.
 * @param keys touches équivalentes.
 * @param action clé du libellé de l'action.
 * @param joiner `slash` : « A / B » ; `or` : « A ou B ».
 */
function item(
  tr: Translator,
  keys: readonly string[],
  action: PlainKey,
  joiner: 'slash' | 'or' = 'slash',
): HintItem {
  const template = CATALOGS[tr.locale]['hud.hint.item'];
  const separator = joiner === 'slash' ? KEY_SEPARATOR : ` ${tr.t('hud.hint.or')} `;
  const out: HintSegment[] = [];
  for (const part of parseTemplate(template, 'hud.hint.item')) {
    if (part.kind === 'text') {
      out.push(text(part.value));
    } else if (part.name === 'keys') {
      keys.forEach((k, i) => {
        if (i > 0) {
          out.push(text(separator));
        }
        out.push(key(k));
      });
    } else {
      out.push(text(tr.t(action)));
    }
  }
  return out;
}

/**
 * Contenu d'un bandeau dans la langue courante (alloue : à n'appeler que quand le bandeau ou la
 * langue change).
 * @param id bandeau.
 * @param tr traducteur.
 * @param levelId niveau : le réglage et le verrou citent Kp (niveau 1) ou Ki (niveau 2).
 */
export function hintLine(id: HintId, tr: Translator, levelId: LevelId = 'level1'): HintLine {
  const escape = tr.t('controls.key.escape');
  const ki = levelId === 'level2';
  switch (id) {
    case 'use':
      return [item(tr, [KEY_SYMBOLS.use], 'hud.hint.use')];
    case 'tune':
      return [
        item(tr, [KEY_SYMBOLS.plus, KEY_SYMBOLS.minus], ki ? 'hud.hint.tuneKi' : 'hud.hint.tune'),
        item(tr, [tr.t('controls.key.pageUp'), tr.t('controls.key.pageDown')], 'hud.hint.tuneBig'),
        item(tr, [KEY_SYMBOLS.use, tr.t('controls.key.enter')], 'hud.hint.launch', 'or'),
      ];
    case 'skip':
      return [
        item(tr, [KEY_SYMBOLS.use, tr.t('controls.key.enter')], 'hud.hint.skip', 'or'),
        item(tr, [KEY_SYMBOLS.restart], 'hud.hint.restart'),
        item(tr, [escape], 'hud.hint.pause'),
      ];
    case 'trip':
      return [
        [text(tr.t(ki ? 'hud.hint.lockedKi' : 'hud.hint.locked'))],
        item(tr, [KEY_SYMBOLS.restart], 'hud.hint.restart'),
        item(tr, [escape], 'hud.hint.pause'),
      ];
    case 'outcome':
      return [item(tr, [KEY_SYMBOLS.restart], 'hud.hint.retry')];
    case 'paused':
      return [[text(tr.t('hud.status.paused'))], item(tr, [escape], 'hud.hint.resume')];
    case 'help':
      return [item(tr, [escape], 'hud.hint.closeHelp')];
    case 'board':
      return [item(tr, [escape], 'hud.hint.closeBoard')];
    case 'pupitre':
      return [item(tr, [escape], 'pupitre.hint.fermer')];
  }
}

/**
 * Texte brut d'un bandeau (lecteurs d'écran, tests) : éléments séparés par « · ».
 * @param line bandeau.
 */
export function hintText(line: HintLine): string {
  return line.map((segments) => segments.map((s) => s.text).join('')).join(' · ');
}
