/**
 * Contenu du tableau d'école (T-042) : l'équation du mouvement de la cabine telle qu'elle est dans
 * le noyau (`createElevator`), l'erreur, la loi de commande (P au niveau 1, PI au niveau 2), la
 * saturation et les valeurs courantes de Kp et Ki. Les valeurs physiques (m, g, c, Umax, r) sont
 * lues du jeu, jamais recopiées ; les textes viennent des catalogues, les formules sont en MathML
 * (`board-math.ts`) et ne dépendent pas de la langue.
 *
 * La construction du contenu est pure (testable sous Node) ; seul {@link renderBoard} touche au DOM.
 */
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS, LEVEL1_SETPOINT, type LevelId } from '../game';
import type { Translator } from '../i18n';
import {
  SIGN,
  createMathElement,
  ddot,
  dot,
  frac,
  math,
  mi,
  miUpright,
  mn,
  mo,
  row,
  space,
  sub,
  underover,
  type MathNode,
} from './board-math';

/** Élément d'une section du tableau. */
export type BoardBlock =
  /** Paragraphe de texte. */
  | { readonly kind: 'text'; readonly text: string; readonly small?: boolean }
  /** Formule seule sur sa ligne. */
  | { readonly kind: 'formula'; readonly math: MathNode; readonly small?: boolean }
  /** Valeur courante d'un gain (réécrite en direct, voir {@link boardValues}). */
  | { readonly kind: 'value'; readonly id: BoardValueId };

/** Valeurs courantes affichées. */
export type BoardValueId = 'kp' | 'ki';

/** Section du tableau : un titre et ses éléments. */
export interface BoardSection {
  /** Identifiant (classe CSS et test). */
  readonly id: 'motion' | 'error' | 'law' | 'saturation' | 'values';
  /** Colonne d'affichage : 1 et 2 côte à côte (l'une sous l'autre en portrait), 3 pleine largeur. */
  readonly column: 1 | 2 | 3;
  /** Titre. */
  readonly heading: string;
  /** Éléments, dans l'ordre. */
  readonly blocks: readonly BoardBlock[];
}

/** Valeurs courantes des gains, déjà mises en forme. */
export interface BoardValues {
  /** « Kp = 2500 N/m » (niveau 2 : « … (fixé) »). */
  readonly kp: string;
  /** « Ki = 800 N/(m·s) » ; vide au niveau 1. */
  readonly ki: string;
}

const m = mi('m');
const g = mi('g');
const c = mi('c');
const y = mi('y');
const e = mi('e');
const u = mi('u');
const r = mi('r');
const times = mo(SIGN.times);
const minus = mo(SIGN.minus);
const equals = mo(SIGN.equals);
/** K_p, K_i : gains. */
const kp = sub(mi('K'), miUpright('p'));
const ki = sub(mi('K'), miUpright('i'));
/** u_sat : force appliquée, après saturation. */
const uSat = sub(u, miUpright('sat'));
/** U_max : force maximale du moteur. */
const uMax = sub(mi('U'), miUpright('max'));
/** m·g : poids. */
const weight = [m, times, g] as const;
/** c·ẏ : frottement visqueux. */
const friction = [c, times, dot(y)] as const;

/** `u_sat − m·g − c·ẏ` : force nette sur la cabine, au dénominateur près. */
function netForce(): MathNode {
  return row(uSat, minus, ...weight, minus, ...friction);
}

/** Texte brut d'un nombre du modèle (jusqu'à deux décimales). */
function plain(tr: Translator, value: number): string {
  return tr.formatNumber(value, { maximumFractionDigits: 2 });
}

/**
 * Sections du tableau pour un niveau et une langue (alloue : à appeler quand la langue change).
 * @param tr traducteur.
 * @param levelId niveau : P au niveau 1, PI au niveau 2.
 */
export function buildBoardSections(tr: Translator, levelId: LevelId): readonly BoardSection[] {
  const pi = levelId === 'level2';
  const motion: BoardSection = {
    id: 'motion',
    column: 1,
    heading: tr.t('board.motion.title'),
    blocks: [
      { kind: 'text', text: tr.t('board.motion.intro') },
      {
        kind: 'formula',
        // m·ÿ = u_sat − m·g − c·ẏ
        math: math(tr.t('board.motion.label'), m, times, ddot(y), equals, netForce()),
      },
      { kind: 'text', text: tr.t('board.motion.again') },
      {
        kind: 'formula',
        // ÿ = (u_sat − m·g − c·ẏ) / m
        math: math(tr.t('board.motion.label2'), ddot(y), equals, frac(netForce(), m)),
      },
      {
        kind: 'text',
        small: true,
        text: tr.t('board.motion.values', {
          m: plain(tr, ELEVATOR_PARAMS.mass),
          g: plain(tr, ELEVATOR_PARAMS.gravity),
          c: plain(tr, ELEVATOR_PARAMS.damping),
        }),
      },
      { kind: 'text', small: true, text: tr.t('board.motion.symbols') },
      { kind: 'text', small: true, text: tr.t('board.motion.ground') },
    ],
  };
  const error: BoardSection = {
    id: 'error',
    column: 1,
    heading: tr.t('board.error.title'),
    blocks: [
      { kind: 'text', text: tr.t('board.error.intro') },
      // e = r − y
      { kind: 'formula', math: math(tr.t('board.error.label'), e, equals, r, minus, y) },
      {
        kind: 'text',
        small: true,
        text: tr.t('board.error.where', { r: plain(tr, LEVEL1_SETPOINT) }),
      },
    ],
  };
  const law: BoardSection = {
    id: 'law',
    column: 2,
    heading: tr.t(pi ? 'board.law.titlePi' : 'board.law.titleP'),
    blocks: pi
      ? [
          { kind: 'text', text: tr.t('board.law.introPi') },
          // u = K_p·e + I
          {
            kind: 'formula',
            math: math(tr.t('board.law.labelPi'), u, equals, kp, times, e, mo(SIGN.plus), mi('I')),
          },
          { kind: 'text', text: tr.t('board.law.integral') },
          {
            kind: 'formula',
            // I = ∫₀ᵗ K_i·e dτ
            math: math(
              tr.t('board.law.labelI'),
              mi('I'),
              equals,
              underover(mo(SIGN.integral), mn('0'), mi('t')),
              ki,
              times,
              e,
              space(),
              mi('d'),
              mi('τ'),
            ),
          },
          { kind: 'text', small: true, text: tr.t('board.law.discrete') },
          {
            kind: 'formula',
            small: true,
            // I ← I + K_i·Δt·e
            math: math(
              tr.t('board.law.labelStep'),
              mi('I'),
              mo(SIGN.arrow),
              mi('I'),
              mo(SIGN.plus),
              ki,
              times,
              mi('Δ'),
              mi('t'),
              times,
              e,
            ),
          },
        ]
      : [
          { kind: 'text', text: tr.t('board.law.introP') },
          // u = K_p·e
          { kind: 'formula', math: math(tr.t('board.law.labelP'), u, equals, kp, times, e) },
        ],
  };
  const saturation: BoardSection = {
    id: 'saturation',
    column: 2,
    heading: tr.t('board.sat.title'),
    blocks: [
      {
        kind: 'text',
        text: tr.t('board.sat.intro', {
          umax: tr.formatNumber(ELEVATOR_MAX_FORCE, { maximumFractionDigits: 0 }),
        }),
      },
      {
        kind: 'formula',
        // u_sat = max(−U_max, min(u, +U_max))
        math: math(
          tr.t('board.sat.label'),
          uSat,
          equals,
          miUpright('max'),
          mo(SIGN.open),
          minus,
          uMax,
          mo(SIGN.comma),
          miUpright('min'),
          mo(SIGN.open),
          u,
          mo(SIGN.comma),
          mo(SIGN.plus),
          uMax,
          mo(SIGN.close),
          mo(SIGN.close),
        ),
      },
    ],
  };
  const values: BoardSection = {
    id: 'values',
    column: 3,
    heading: tr.t('board.values.title'),
    blocks: pi
      ? [
          { kind: 'value', id: 'kp' },
          { kind: 'value', id: 'ki' },
        ]
      : [{ kind: 'value', id: 'kp' }],
  };
  return [motion, error, law, saturation, values];
}

/**
 * Valeurs courantes des gains, mises en forme dans la langue courante.
 * @param tr traducteur.
 * @param levelId niveau.
 * @param kpNow Kp courant (N/m).
 * @param kiNow Ki courant (N/(m·s)).
 */
export function boardValues(
  tr: Translator,
  levelId: LevelId,
  kpNow: number,
  kiNow: number,
): BoardValues {
  const kpText = tr.formatNumber(kpNow, { maximumFractionDigits: 0 });
  if (levelId === 'level2') {
    return {
      kp: tr.t('level2.kp.fixed', { kp: kpText }),
      ki: tr.t('board.value.ki', { ki: tr.formatNumber(kiNow, { maximumFractionDigits: 0 }) }),
    };
  }
  return { kp: tr.t('hud.kp.value', { kp: kpText }), ki: '' };
}

/** Éléments réécrits en direct par l'interface : les lignes de valeurs. */
export type BoardValueNodes = Readonly<Partial<Record<BoardValueId, HTMLElement>>>;

/**
 * Remplit `container` avec les sections du tableau (DOM) ; vide d'abord son contenu.
 * @param doc document.
 * @param container élément à remplir.
 * @param sections contenu ({@link buildBoardSections}).
 * @returns les lignes de valeurs, à mettre à jour en direct.
 */
export function renderBoard(
  doc: Document,
  container: HTMLElement,
  sections: readonly BoardSection[],
): BoardValueNodes {
  container.replaceChildren();
  const nodes: Partial<Record<BoardValueId, HTMLElement>> = {};
  const columns = [1, 2].map((n) => {
    const column = doc.createElement('div');
    column.className = `ui-board-col ui-board-col-${String(n)}`;
    return column;
  });
  for (const section of sections) {
    const node = doc.createElement('section');
    node.className = `ui-board-section ui-board-${section.id}`;
    const heading = doc.createElement('h3');
    heading.textContent = section.heading;
    node.append(heading);
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'text': {
          const p = doc.createElement('p');
          p.className = block.small === true ? 'ui-board-text ui-board-small' : 'ui-board-text';
          p.textContent = block.text;
          node.append(p);
          break;
        }
        case 'formula': {
          const wrapper = doc.createElement('div');
          wrapper.className =
            block.small === true ? 'ui-board-formula ui-board-small' : 'ui-board-formula';
          wrapper.append(createMathElement(doc, block.math));
          node.append(wrapper);
          break;
        }
        case 'value': {
          const p = doc.createElement('p');
          p.className = `ui-board-value ui-board-value-${block.id}`;
          node.append(p);
          nodes[block.id] = p;
          break;
        }
      }
    }
    (section.column === 3 ? container : (columns[section.column - 1] ?? container)).append(node);
  }
  // Les deux colonnes passent avant la bande des valeurs.
  container.prepend(...columns);
  return nodes;
}
