/**
 * Modèle de vue de l'interface (T-010) : « instantané + langue + état de l'UI → ce qu'il faut
 * afficher ». Pur (ni DOM, ni horloge). Le modèle est UN objet réécrit en place ; chaque texte
 * n'est recalculé que si ce dont il dépend a changé (langue, phase, valeur arrondie à l'affichage),
 * sinon la même chaîne est gardée : en régime établi, la couche DOM compare les références et
 * n'écrit rien, et le modèle n'alloue que lorsqu'un chiffre affiché change.
 */
import {
  ELEVATOR_MAX_FORCE,
  type LevelId,
  type LevelPhase,
  type LevelSnapshot,
  type TripOutcome,
} from '../game';
import { otherLocale, type Locale, type Translator } from '../i18n';
import { ERROR_DIGITS, formatError, formatKp } from './announce';
import { chooseHint, hintLine, type HintId, type HintLine } from './hints';

/** État propre à l'interface (hors niveau). */
export interface UiState {
  /** Aide des commandes ouverte. */
  readonly helpOpen: boolean;
  /** Tableau d'école ouvert (absent : fermé). */
  readonly boardOpen?: boolean;
  /** Pupitre de contrôle ouvert en lecture seule (absent : non). */
  readonly pupitreLecture?: boolean;
}

/** Textes qui ne dépendent que de la langue. */
export interface StaticTexts {
  /** Titre du jeu (`app.title`), aussi titre du document. */
  readonly title: string;
  /** Libellé du bouton de langue (nom de l'autre langue, dans cette langue). */
  readonly languageButton: string;
  /** Description du bouton de langue. */
  readonly languageDescription: string;
  /** Libellé accessible du canvas. */
  readonly canvasLabel: string;
  /** Nom de la région des annonces. */
  readonly liveLabel: string;
  /** Nom du bandeau d'aide. */
  readonly hintLabel: string;
  /** Bouton « ? » : afficher l'aide. */
  readonly helpShow: string;
  /** Bouton « ? » : masquer l'aide. */
  readonly helpHide: string;
  /** Titre de l'aide des commandes. */
  readonly helpTitle: string;
  /** Lignes de l'aide des commandes (clavier, souris, tactile). */
  readonly helpLines: readonly string[];
  /** Bouton de fermeture de l'aide. */
  readonly helpClose: string;
  /** Nom de la zone cliquable du chevalet (ouvre le tableau d'école). */
  readonly boardOpen: string;
  /** Titre du tableau d'école. */
  readonly boardTitle: string;
  /** Bouton de fermeture du tableau d'école. */
  readonly boardClose: string;
  /** Bouton de la barre du haut qui ouvre ou ferme le pupitre de contrôle. */
  readonly pupitreButton: string;
  /** Nom accessible de ce bouton (titre du pupitre). */
  readonly pupitreLabel: string;
  /** Bouton pause. */
  readonly pause: string;
  /** Bouton reprise. */
  readonly resume: string;
  /** Bouton « Menu » (retour au menu des niveaux). */
  readonly menu: string;
  /** Bouton « Rejouer le niveau ». */
  readonly replay: string;
  /** Nom du bloc des mesures du trajet. */
  readonly readoutLabel: string;
  /** Mention « Saturé ». */
  readonly saturated: string;
  /** Titre de la légende. */
  readonly legendTitle: string;
  /** Lignes de la légende (consigne, hauteur, erreur ; niveau 2 : et jauge I). */
  readonly legendLines: readonly string[];
  /** Haut de l'échelle de la jauge (« 5000 N max »). */
  readonly gaugeMax: string;
  /** Repère du poids m·g à droite de la jauge (« poids »). */
  readonly gaugeWeight: string;
  /** Légende de la jauge du terme intégral avant le lancement (« Terme intégral I »). */
  readonly integralTitle: string;
  /** Teaser du terme I. */
  readonly teaser: string;
  /** Bouton « Niveau suivant » du panneau de réussite. */
  readonly nextLevel: string;
  /** Invite à tourner l'appareil. */
  readonly rotateHint: string;
  /** Nom du groupe des commandes tactiles. */
  readonly touchLabel: string;
  /** Bouton tactile ◀. */
  readonly moveLeft: string;
  /** Bouton tactile ▶. */
  readonly moveRight: string;
  /** Bouton tactile « Action ». */
  readonly action: string;
}

/** Modèle de vue, réécrit en place par {@link ViewModelBuilder.build}. */
export interface ViewModel {
  /** Langue courante (attribut `lang` du document). */
  locale: Locale;
  /** Langue proposée par le bouton (attribut `lang` de son libellé). */
  otherLocale: Locale;
  /** Textes fixes de la langue courante (même objet tant que la langue ne change pas). */
  texts: StaticTexts;
  /** Phase effective (en pause : la phase qui reprendra). */
  phase: LevelPhase;
  /** Vrai en pause. */
  paused: boolean;
  /** Aide des commandes ouverte. */
  helpOpen: boolean;
  /** Tableau d'école ouvert. */
  boardOpen: boolean;
  /** Pupitre de contrôle ouvert en lecture seule. */
  pupitreReadOnly: boolean;
  /** Bandeau courant. */
  hintId: HintId;
  /** Contenu du bandeau (même objet tant que bandeau et langue ne changent pas). */
  hint: HintLine;
  /** Étiquette permanente « Kp = 2500 N/m » (niveau 1) ou « Kp = 2500 · Ki = 2000 » (niveau 2). */
  kpTag: string;
  /** Bulle : objectif ou invite à la console ; vide si aucune. */
  bubble: string;
  /** Mesures du trajet visibles (trajet, sortie et issue). */
  readoutVisible: boolean;
  /** « Temps : 1,2 s ». */
  time: string;
  /** « Erreur : 0,85 m ». */
  error: string;
  /** « I : 490 N », posé à l'ancre de la jauge du terme intégral (niveau 2) ; vide au niveau 1. */
  integral: string;
  /** « Terme I : 490 N », ligne des mesures lue par les lecteurs d'écran (niveau 2) ; vide sinon. */
  integralReadout: string;
  /** Force écrêtée au dernier pas. */
  saturated: boolean;
  /**
   * État par défaut de la légende des tracés : dépliée pendant le premier trajet seulement,
   * repliée ensuite (le choix explicite du joueur l'emporte, côté DOM).
   */
  legendOpenByDefault: boolean;
  /** Issue visible : en phase `outcome` seulement (après la sortie, pour une victoire animée). */
  outcomeVisible: boolean;
  /** Issue courante (null hors issue). */
  outcome: TripOutcome | null;
  /** Titre de l'issue. */
  outcomeTitle: string;
  /** Message pédagogique de l'issue. */
  outcomeMessage: string;
  /** Cote mesurée « e = 0,20 m » (victoire), vide sinon. */
  dimension: string;
  /** Formule avec e théorique (victoire), vide sinon. */
  formula: string;
  /** Libellé du bouton de l'issue. */
  outcomeButton: string;
}

/** Constructeur incrémental du modèle de vue. */
export interface ViewModelBuilder {
  /** Modèle courant (objet unique). */
  readonly model: Readonly<ViewModel>;
  /**
   * Réécrit le modèle d'après l'instantané et l'état de l'UI ; renvoie le modèle.
   * @param s instantané (lu, jamais conservé).
   * @param ui état de l'interface.
   */
  build(s: Readonly<LevelSnapshot>, ui: UiState): Readonly<ViewModel>;
}

/**
 * Phase effective : en pause, celle qui reprendra.
 * @param s instantané.
 */
export function effectivePhase(s: Readonly<LevelSnapshot>): LevelPhase {
  return s.phase === 'paused' && s.resumePhase !== null ? s.resumePhase : s.phase;
}

/**
 * Textes fixes d'une langue (alloue : une fois par changement de langue).
 * @param tr traducteur réglé sur la langue voulue.
 * @param levelId niveau : les textes du réglage et de l'aide suivent la grandeur réglée.
 */
export function staticTexts(tr: Translator, levelId: LevelId = 'level1'): StaticTexts {
  const ki = levelId === 'level2';
  return {
    title: tr.t('app.title'),
    languageButton: tr.t('app.language.switch'),
    languageDescription: tr.t('app.language.switchLabel'),
    canvasLabel: tr.t('a11y.canvas'),
    liveLabel: tr.t('a11y.liveRegion'),
    hintLabel: tr.t('hud.hint.label'),
    helpShow: tr.t('controls.help.show'),
    helpHide: tr.t('controls.help.hide'),
    helpTitle: tr.t('controls.help.title'),
    helpLines: [
      tr.t('controls.help.move'),
      tr.t('controls.help.interact'),
      tr.t('controls.help.skip'),
      tr.t(ki ? 'controls.help.ki' : 'controls.help.kp'),
      tr.t('controls.help.restart'),
      tr.t('controls.help.pause'),
      tr.t('controls.help.mouse'),
      tr.t(ki ? 'controls.help.touchKi' : 'controls.help.touch'),
      tr.t('controls.help.board'),
      tr.t('controls.help.pupitre'),
    ],
    helpClose: tr.t('controls.help.close'),
    boardOpen: tr.t('board.open'),
    boardTitle: tr.t('board.title'),
    boardClose: tr.t('board.close'),
    pupitreButton: tr.t('pupitre.bouton'),
    pupitreLabel: tr.t('pupitre.titre'),
    pause: tr.t('controls.pause'),
    resume: tr.t('controls.resume'),
    menu: tr.t('controls.menu'),
    replay: tr.t('level1.replay'),
    readoutLabel: tr.t('hud.readout.label'),
    saturated: tr.t('hud.saturated'),
    legendTitle: tr.t('hud.legend.title'),
    legendLines: [
      tr.t('hud.legend.setpoint'),
      tr.t('hud.legend.position'),
      tr.t('hud.legend.error'),
      ...(ki ? [tr.t('level2.legend.integral')] : []),
    ],
    gaugeMax: tr.t('hud.gauge.max', {
      n: tr.formatNumber(ELEVATOR_MAX_FORCE, { maximumFractionDigits: 0 }),
    }),
    gaugeWeight: tr.t('hud.gauge.weight'),
    integralTitle: tr.t('hud.igauge.title'),
    teaser: tr.t('level1.teaser'),
    nextLevel: tr.t('controls.nextLevel'),
    rotateHint: tr.t('app.rotateHint'),
    touchLabel: tr.t('a11y.touchControls'),
    moveLeft: tr.t('controls.moveLeft'),
    moveRight: tr.t('controls.moveRight'),
    action: tr.t('controls.action'),
  };
}

/** Arrondi d'affichage : entier comparable (évite de reformater une valeur affichée identique). */
function quantize(value: number, scale: number): number {
  return Number.isFinite(value) ? Math.round(value * scale) : Number.NaN;
}

/** Textes d'une issue. */
interface OutcomeTexts {
  title: string;
  message: string;
  dimension: string;
  formula: string;
  button: string;
}

/** Titre et message d'une issue du niveau 2. */
function outcomeTexts2(
  tr: Translator,
  outcome: TripOutcome,
  s: Readonly<LevelSnapshot>,
): OutcomeTexts {
  const error = s.finalError ?? s.e;
  const restart = tr.t('controls.restart');
  switch (outcome) {
    case 'win':
      return {
        title: tr.t('level2.winTitle'),
        message: tr.t('level2.win'),
        dimension: tr.t('level1.dimension', { e: formatError(tr, Math.abs(error)) }),
        formula: '',
        button: tr.t('level1.replay'),
      };
    case 'slow':
      return {
        title: tr.t('level2.failTitle.slow'),
        message: tr.t('level2.fail.slow'),
        dimension: '',
        formula: '',
        button: restart,
      };
    case 'bonk':
      return {
        title: tr.t('level2.failTitle.bonk'),
        message: tr.t('level2.fail.bonk'),
        dimension: '',
        formula: '',
        button: restart,
      };
    case 'step':
    case 'noLift':
      return {
        title: tr.t('level2.failTitle.step'),
        message: tr.t('level2.fail.step', { e: formatError(tr, error) }),
        dimension: '',
        formula: '',
        button: restart,
      };
  }
}

/** Titre et message d'une issue. */
function outcomeTexts(
  tr: Translator,
  outcome: TripOutcome,
  s: Readonly<LevelSnapshot>,
): OutcomeTexts {
  if (s.levelId === 'level2') {
    return outcomeTexts2(tr, outcome, s);
  }
  const measured = formatError(tr, s.finalError ?? s.e);
  switch (outcome) {
    case 'win':
      return {
        title: tr.t('level1.winTitle'),
        message: tr.t('level1.win'),
        dimension: tr.t('level1.dimension', { e: measured }),
        formula: tr.t('level1.formula', {
          kp: formatKp(tr, s.kp),
          e: tr.formatNumber(
            Number.isFinite(s.theoreticalError) ? s.theoreticalError : 0,
            ERROR_DIGITS,
          ),
        }),
        button: tr.t('level1.replay'),
      };
    case 'step':
    case 'slow':
      return {
        title: tr.t('level1.failTitle.step'),
        message: tr.t('level1.fail.step', { e: measured }),
        dimension: '',
        formula: '',
        button: tr.t('controls.restart'),
      };
    case 'noLift':
      return {
        title: tr.t('level1.failTitle.noLift'),
        message: tr.t('level1.fail.noLift'),
        dimension: '',
        formula: '',
        button: tr.t('controls.restart'),
      };
    case 'bonk':
      return {
        title: tr.t('level1.failTitle.bonk'),
        message: tr.t('level1.fail.bonk'),
        dimension: '',
        formula: '',
        button: tr.t('controls.restart'),
      };
  }
}

/**
 * Crée un constructeur de modèle de vue lié à un traducteur (dont la langue peut changer : le
 * modèle suit la langue courante à chaque {@link ViewModelBuilder.build}).
 * @param tr traducteur.
 * @param levelId niveau affiché (défaut `level1`).
 */
export function createViewModelBuilder(
  tr: Translator,
  levelId: LevelId = 'level1',
): ViewModelBuilder {
  const ki = levelId === 'level2';
  let locale: Locale | null = null;
  let texts = staticTexts(tr, levelId);
  // Clés de mémoïsation : la chaîne n'est refaite que si la clé change.
  let hintKey = '';
  let kpKey = Number.NaN;
  let timeKey = Number.NaN;
  let errorKey = Number.NaN;
  let integralKey = Number.NaN;
  let bubbleKey = '';
  let outcomeKey: TripOutcome | null = null;
  let outcomeAttempt = -1;

  const model: ViewModel = {
    locale: tr.locale,
    otherLocale: otherLocale(tr.locale),
    texts,
    phase: 'approach',
    paused: false,
    helpOpen: false,
    boardOpen: false,
    pupitreReadOnly: false,
    hintId: 'use',
    hint: [],
    kpTag: '',
    bubble: '',
    readoutVisible: false,
    time: '',
    error: '',
    integral: '',
    integralReadout: '',
    saturated: false,
    legendOpenByDefault: false,
    outcomeVisible: false,
    outcome: null,
    outcomeTitle: '',
    outcomeMessage: '',
    dimension: '',
    formula: '',
    outcomeButton: '',
  };

  const build = (s: Readonly<LevelSnapshot>, ui: UiState): Readonly<ViewModel> => {
    if (locale !== tr.locale) {
      locale = tr.locale;
      texts = staticTexts(tr, levelId);
      model.locale = locale;
      model.otherLocale = otherLocale(locale);
      model.texts = texts;
      hintKey = '';
      kpKey = Number.NaN;
      timeKey = Number.NaN;
      errorKey = Number.NaN;
      integralKey = Number.NaN;
      bubbleKey = '';
      outcomeAttempt = -1;
    }
    const phase = effectivePhase(s);
    model.phase = phase;
    model.paused = s.phase === 'paused';
    model.helpOpen = ui.helpOpen;
    const boardOpen = ui.boardOpen === true;
    model.boardOpen = boardOpen;
    const pupitreReadOnly = ui.pupitreLecture === true;
    model.pupitreReadOnly = pupitreReadOnly;

    const hintId = chooseHint(s, ui.helpOpen, boardOpen, pupitreReadOnly);
    if (hintId !== hintKey) {
      hintKey = hintId;
      model.hintId = hintId;
      model.hint = hintLine(hintId, tr, levelId);
    }

    // Étiquette de la barre du haut : Kp au niveau 1 ; Kp (fixé) et Ki au niveau 2.
    const tuned = ki ? s.ki : s.kp;
    if (tuned !== kpKey) {
      kpKey = tuned;
      const kp = formatKp(tr, s.kp);
      model.kpTag = ki
        ? tr.t('hud.ki.tag', { kp, ki: formatKp(tr, s.ki) })
        : tr.t('hud.kp.value', { kp });
    }

    const bubble = phase !== 'approach' ? 'none' : s.atConsole ? 'prompt' : 'goal';
    if (bubble !== bubbleKey) {
      bubbleKey = bubble;
      model.bubble =
        bubble === 'goal'
          ? tr.t(ki ? 'level2.goal' : 'level1.goal')
          : bubble === 'prompt'
            ? tr.t('level1.console.prompt')
            : '';
    }

    // La sortie montre encore le trajet (mesures, légende) ; l'issue n'apparaît qu'en `outcome`.
    model.readoutVisible = phase === 'trip' || phase === 'exit' || phase === 'outcome';
    model.legendOpenByDefault = (phase === 'trip' || phase === 'exit') && s.attempt === 1;
    if (model.readoutVisible) {
      const t = quantize(s.t, 10);
      if (t !== timeKey) {
        timeKey = t;
        model.time = tr.t('hud.time.value', {
          t: tr.formatNumber(s.t, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        });
      }
      const e = quantize(s.e, 100);
      if (e !== errorKey) {
        errorKey = e;
        model.error = tr.t('hud.error.value', { e: formatError(tr, s.e) });
      }
      if (ki) {
        const i = quantize(s.iTerm, 1);
        if (i !== integralKey) {
          integralKey = i;
          const value = tr.formatNumber(Number.isFinite(s.iTerm) ? s.iTerm : 0, {
            maximumFractionDigits: 0,
          });
          model.integral = tr.t('hud.igauge.value', { i: value });
          model.integralReadout = tr.t('hud.readout.iTerm', { i: value });
        }
      }
      model.saturated = s.saturated;
    } else {
      model.saturated = false;
    }

    const outcome = phase === 'outcome' ? s.outcome : null;
    model.outcomeVisible = outcome !== null;
    if (outcome !== outcomeKey || s.attempt !== outcomeAttempt) {
      outcomeKey = outcome;
      outcomeAttempt = s.attempt;
      model.outcome = outcome;
      if (outcome === null) {
        model.outcomeTitle = '';
        model.outcomeMessage = '';
        model.dimension = '';
        model.formula = '';
        model.outcomeButton = '';
      } else {
        const o = outcomeTexts(tr, outcome, s);
        model.outcomeTitle = o.title;
        model.outcomeMessage = o.message;
        model.dimension = o.dimension;
        model.formula = o.formula;
        model.outcomeButton = o.button;
      }
    }
    return model;
  };

  return { model, build };
}
