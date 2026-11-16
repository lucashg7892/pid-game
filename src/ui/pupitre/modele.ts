/**
 * Modèle du pupitre de contrôle (T-049, décisions D35 et D36) : règles pures (ni DOM, ni canvas)
 * qui disent ce que montre le pupitre selon le niveau et la phase, et conversions entre la
 * position d'un levier et la valeur réglée.
 *
 * Le pupitre est visible dans deux cas :
 * - phase de réglage (`tuning`) : il s'ouvre tout seul, comme le panneau qu'il remplace ; les
 *   leviers sont libres (sauf celui qui n'existe pas au niveau) ; en pause, il se masque ;
 * - ouverture « en lecture seule » demandée par le joueur (touche E ou bouton « Pupitre » en
 *   trajet, embarquement, sortie, issue, pause) : valeurs affichées, réglages et bouton grisés,
 *   et AUCUNE pause (le jeu continue).
 */
import type { LevelId, LevelPhase, TripOutcome, TuningSpec } from '../../game';

/** Mode du pupitre : réglage libre, ou lecture seule. */
export type ModePupitre = 'edition' | 'lecture';

/**
 * État d'un levier :
 * - `libre` : réglable ;
 * - `verrouille` : réglable en principe, figé maintenant (trajet, pause, issue) ;
 * - `fixe` : valeur imposée par le niveau (Kp au niveau 2) ;
 * - `hors-service` : sans objet au niveau (Ki au niveau 1, il n'y a pas de terme intégral).
 */
export type EtatLevier = 'libre' | 'verrouille' | 'fixe' | 'hors-service';

/** Ce que le pupitre montre et permet, d'après le niveau et la phase. */
export interface ReglagePupitre {
  /** Réglage libre ou lecture seule. */
  readonly mode: ModePupitre;
  /** État du levier Kp. */
  readonly kp: EtatLevier;
  /** État du levier Ki. */
  readonly ki: EtatLevier;
  /** Bouton « Lancer » visible (phase de réglage et hors embarquement et trajet). */
  readonly lancerVisible: boolean;
  /** Bouton « Lancer » actif (réglage libre seulement). */
  readonly lancerActif: boolean;
  /** Bouton « Recommencer » visible (embarquement et trajet : il remplace « Lancer »). */
  readonly recommencerVisible: boolean;
  /** Bouton « Recommencer » actif (pas en pause). */
  readonly recommencerActif: boolean;
}

/**
 * État du réglage d'après le niveau, la phase effective (en pause : celle qui reprendra) et la
 * pause.
 * @param levelId niveau.
 * @param phase phase effective.
 * @param paused vrai en pause.
 */
export function reglageDe(levelId: LevelId, phase: LevelPhase, paused: boolean): ReglagePupitre {
  const edition = phase === 'tuning' && !paused;
  const regle: EtatLevier = edition ? 'libre' : 'verrouille';
  const enCours = phase === 'boarding' || phase === 'trip';
  return {
    mode: edition ? 'edition' : 'lecture',
    kp: levelId === 'level2' ? 'fixe' : regle,
    ki: levelId === 'level2' ? regle : 'hors-service',
    lancerVisible: !enCours,
    lancerActif: edition,
    recommencerVisible: enCours,
    recommencerActif: enCours && !paused,
  };
}

/**
 * Vrai si le pupitre est visible : phase de réglage (hors pause : en pause, le réglage se masque
 * et revient à la reprise), ou ouverture en lecture seule demandée.
 * @param phase phase effective.
 * @param enPause vrai en pause.
 * @param lectureOuverte vrai si le joueur a ouvert le pupitre en lecture seule.
 */
export function pupitreVisible(
  phase: LevelPhase,
  enPause: boolean,
  lectureOuverte: boolean,
): boolean {
  return lectureOuverte || (phase === 'tuning' && !enPause);
}

/** Texte d'état du pupitre (clé de traduction). */
export type CleEtat =
  | 'pupitre.etat.approach'
  | 'pupitre.etat.tuning'
  | 'pupitre.etat.boarding'
  | 'pupitre.etat.trip'
  | 'pupitre.etat.exit'
  | 'pupitre.etat.outcome'
  | 'pupitre.etat.paused';

/**
 * Clé du texte d'état d'après la phase effective et la pause.
 * @param phase phase effective.
 * @param paused vrai en pause.
 */
export function cleEtat(phase: LevelPhase, paused: boolean): CleEtat {
  if (paused) {
    return 'pupitre.etat.paused';
  }
  return `pupitre.etat.${phase === 'paused' ? 'approach' : phase}`;
}

/**
 * Clé du titre d'une issue (mêmes textes que le panneau d'issue).
 * @param levelId niveau.
 * @param outcome issue.
 */
export function cleTitreIssue(
  levelId: LevelId,
  outcome: TripOutcome,
):
  | 'level1.winTitle'
  | 'level2.winTitle'
  | 'level1.failTitle.noLift'
  | 'level1.failTitle.step'
  | 'level1.failTitle.bonk'
  | 'level2.failTitle.step'
  | 'level2.failTitle.slow'
  | 'level2.failTitle.bonk' {
  if (levelId === 'level2') {
    switch (outcome) {
      case 'win':
        return 'level2.winTitle';
      case 'slow':
        return 'level2.failTitle.slow';
      case 'bonk':
        return 'level2.failTitle.bonk';
      default:
        return 'level2.failTitle.step';
    }
  }
  switch (outcome) {
    case 'win':
      return 'level1.winTitle';
    case 'noLift':
      return 'level1.failTitle.noLift';
    case 'bonk':
      return 'level1.failTitle.bonk';
    default:
      return 'level1.failTitle.step';
  }
}

/**
 * Position d'une valeur sur la glissière, dans [0 ; 1] (0 en bas, bornes comprises).
 * @param valeur valeur réglée.
 * @param spec bornes et pas du réglage.
 */
export function fractionDe(valeur: number, spec: Readonly<TuningSpec>): number {
  if (!Number.isFinite(valeur) || spec.max <= spec.min) {
    return 0;
  }
  return Math.min(1, Math.max(0, (valeur - spec.min) / (spec.max - spec.min)));
}

/**
 * Valeur correspondant à une position sur la glissière : bornée, arrondie au pas.
 * @param fraction position dans [0 ; 1] (hors de l'intervalle : ramenée à la borne).
 * @param spec bornes et pas du réglage.
 */
export function valeurDe(fraction: number, spec: Readonly<TuningSpec>): number {
  if (!Number.isFinite(fraction)) {
    return spec.min;
  }
  const f = Math.min(1, Math.max(0, fraction));
  const brut = spec.min + f * (spec.max - spec.min);
  const arrondi = spec.min + Math.round((brut - spec.min) / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, arrondi));
}

/** Graduation d'une glissière. */
export interface Graduation {
  /** Valeur. */
  readonly valeur: number;
  /** Vrai si la graduation porte un chiffre. */
  readonly etiquetee: boolean;
}

/**
 * Graduations d'une glissière : un trait tous les `tousLes`, un chiffre tous les `etiquetteTousLes`.
 * @param spec bornes du réglage.
 * @param tousLes écart entre deux traits.
 * @param etiquetteTousLes écart entre deux chiffres.
 */
export function graduations(
  spec: Readonly<TuningSpec>,
  tousLes: number,
  etiquetteTousLes: number,
): Graduation[] {
  const sortie: Graduation[] = [];
  if (tousLes <= 0 || etiquetteTousLes <= 0) {
    return sortie;
  }
  for (let v = spec.min; v <= spec.max + 1e-9; v += tousLes) {
    const rang = (v - spec.min) / etiquetteTousLes;
    sortie.push({ valeur: v, etiquetee: Math.abs(rang - Math.round(rang)) < 1e-9 });
  }
  return sortie;
}
