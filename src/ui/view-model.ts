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
  /** Bouton pause. */
  readonly pause: string;
  /** Bouton reprise. */
  readonly resume: string;
  /** Bouton « Menu » (retour au menu des niveaux). */
  readonly menu: string;
  /** Nom du panneau de réglage. */
  readonly panelLabel: string;
  /**
   * Titre du panneau de réglage. Les textes `kp*` du réglage sont ceux de Kp au niveau 1 et ceux
   * de Ki au niveau 2 (les noms gardent le préfixe historique).
   */
  readonly kpLabel: string;
  /** Nom du champ numérique. */
  readonly kpField: string;
  /** Aide de la grandeur réglée. */
  readonly kpHelp: string;
  /** Plage de la grandeur réglée. */
  readonly kpRange: string;
  /** Message de verrouillage. */
  readonly kpLocked: string;
  /** Nom du bouton −. */
  readonly kpDecrease: string;
  /** Nom du bouton +. */
  readonly kpIncrease: string;
  /** Bouton « Lancer ». */
  readonly launch: string;
  /** Bouton « Recommencer ». */
  readonly restart: string;
  /** Bouton « Rejouer le niveau ». */
  readonly replay: string;
  /** Nom du bloc des mesures du trajet. */
  readonly readoutLabel: string;
  /** Mention « Saturé ». */
  readonly saturated: string;
  /** Titre de la légende. */
  readonly legendTitle: string;
  /** Lignes de la légende (consigne, hauteur, erreur, jauge). */
  readonly legendLines: readonly string[];
  /** Nom de la jauge de force. */
  readonly gaugeLabel: string;
  /** Légende de la jauge avant le lancement (« Force du moteur »). */
  readonly gaugeTitle: string;
  /** Haut de l'échelle de la jauge (« 5000 N max »). */
  readonly gaugeMax: string;
  /** Repère du poids m·g à droite de la jauge (« poids »). */
  readonly gaugeWeight: string;
  /** Teaser du terme I. */
  readonly teaser: string;
  /** « Ce niveau arrive bientôt ». */
  readonly comingSoon: string;
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
  /** Bandeau courant. */
  hintId: HintId;
  /** Contenu du bandeau (même objet tant que bandeau et langue ne changent pas). */
  hint: HintLine;
  /** Étiquette permanente « Kp = 2500 N/m » (niveau 1) ou « Kp = 2500 · Ki = 500 » (niveau 2). */
  kpTag: string;
  /** Kp fixé du niveau 2 (« Kp = 2500 N/m (fixé) ») ; vide au niveau 1, où Kp est le réglage. */
  fixedKp: string;
  /** Bulle : objectif ou invite à la console ; vide si aucune. */
  bubble: string;
  /** Panneau Kp visible (réglage et trajet). */
  panelOpen: boolean;
  /** Panneau Kp verrouillé (trajet, pause). */
  panelLocked: boolean;
  /** Valeur réglée (Kp au niveau 1, Ki au niveau 2), pour le curseur et le champ. */
  kp: number;
  /** Valeur affichée dans le panneau (« 2500 N/m », « 500 N/(m·s) »). */
  kpValue: string;
  /** Valeur dite par les lecteurs d'écran (« 2500 newtons par mètre »). */
  kpValueText: string;
  /** Mesures du trajet visibles (trajet et issue). */
  readoutVisible: boolean;
  /** « Temps : 1,2 s ». */
  time: string;
  /** « Erreur : 0,85 m ». */
  error: string;
  /** « Force : 4200 N », posé à l'ancre de la jauge. */
  force: string;
  /** Force écrêtée au dernier pas. */
  saturated: boolean;
  /**
   * État par défaut de la légende des tracés : dépliée pendant le premier trajet seulement,
   * repliée ensuite (le choix explicite du joueur l'emporte, côté DOM).
   */
  legendOpenByDefault: boolean;
  /** Issue visible. */
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
      tr.t(ki ? 'controls.help.ki' : 'controls.help.kp'),
      tr.t('controls.help.restart'),
      tr.t(ki ? 'controls.help.pauseKi' : 'controls.help.pause'),
      tr.t('controls.help.mouse'),
      tr.t(ki ? 'controls.help.touchKi' : 'controls.help.touch'),
    ],
    helpClose: tr.t('controls.help.close'),
    pause: tr.t('controls.pause'),
    resume: tr.t('controls.resume'),
    menu: tr.t('controls.menu'),
    panelLabel: tr.t('a11y.kpPanel'),
    kpLabel: tr.t(ki ? 'level2.ki.label' : 'level1.kp.label'),
    kpField: tr.t(ki ? 'level2.ki.field' : 'level1.kp.field'),
    kpHelp: tr.t(ki ? 'level2.ki.help' : 'level1.kp.help'),
    kpRange: tr.t(ki ? 'level2.ki.range' : 'level1.kp.range'),
    kpLocked: tr.t(ki ? 'level2.ki.locked' : 'level1.kp.locked'),
    kpDecrease: tr.t(ki ? 'controls.kiDecrease' : 'controls.kpDecrease'),
    kpIncrease: tr.t(ki ? 'controls.kiIncrease' : 'controls.kpIncrease'),
    launch: tr.t('controls.launch'),
    restart: tr.t('controls.restart'),
    replay: tr.t('level1.replay'),
    readoutLabel: tr.t('hud.readout.label'),
    saturated: tr.t('hud.saturated'),
    legendTitle: tr.t('hud.legend.title'),
    legendLines: [
      tr.t('hud.legend.setpoint'),
      tr.t('hud.legend.position'),
      tr.t('hud.legend.error'),
      tr.t('hud.legend.force'),
    ],
    gaugeLabel: tr.t('a11y.forceGauge'),
    gaugeTitle: tr.t('hud.gauge.title'),
    gaugeMax: tr.t('hud.gauge.max', {
      n: tr.formatNumber(ELEVATOR_MAX_FORCE, { maximumFractionDigits: 0 }),
    }),
    gaugeWeight: tr.t('hud.gauge.weight'),
    teaser: tr.t('level1.teaser'),
    comingSoon: tr.t('level1.comingSoon'),
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
  let forceKey = Number.NaN;
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
    hintId: 'walk',
    hint: [],
    kpTag: '',
    fixedKp: '',
    bubble: '',
    panelOpen: false,
    panelLocked: false,
    kp: 0,
    kpValue: '',
    kpValueText: '',
    readoutVisible: false,
    time: '',
    error: '',
    force: '',
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
      forceKey = Number.NaN;
      bubbleKey = '';
      outcomeAttempt = -1;
    }
    const phase = effectivePhase(s);
    model.phase = phase;
    model.paused = s.phase === 'paused';
    model.helpOpen = ui.helpOpen;

    const hintId = chooseHint(s, ui.helpOpen);
    if (hintId !== hintKey) {
      hintKey = hintId;
      model.hintId = hintId;
      model.hint = hintLine(hintId, tr, levelId);
    }

    // Valeur réglée : Kp au niveau 1 ; Ki au niveau 2 (Kp y est fixé).
    const tuned = ki ? s.ki : s.kp;
    if (tuned !== kpKey) {
      kpKey = tuned;
      const kp = formatKp(tr, s.kp);
      model.kp = tuned;
      if (ki) {
        const kiText = formatKp(tr, s.ki);
        model.kpTag = tr.t('hud.ki.tag', { kp, ki: kiText });
        model.fixedKp = tr.t('level2.kp.fixed', { kp });
        model.kpValue = tr.formatQuantity(s.ki, 'N/(m·s)', { maximumFractionDigits: 0 });
        model.kpValueText = tr.t('level2.ki.valueText', { ki: kiText });
      } else {
        model.kpTag = tr.t('hud.kp.value', { kp });
        model.kpValue = tr.formatQuantity(s.kp, 'N/m', { maximumFractionDigits: 0 });
        model.kpValueText = tr.t('level1.kp.valueText', { kp });
      }
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

    model.panelOpen = phase === 'tuning' || phase === 'trip';
    model.panelLocked = phase !== 'tuning' || model.paused;

    model.readoutVisible = phase === 'trip' || phase === 'outcome';
    model.legendOpenByDefault = phase === 'trip' && s.attempt === 1;
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
      const u = quantize(s.uSat, 1);
      if (u !== forceKey) {
        forceKey = u;
        model.force = tr.t('hud.force.value', {
          u: tr.formatNumber(Number.isFinite(s.uSat) ? s.uSat : 0, { maximumFractionDigits: 0 }),
        });
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
