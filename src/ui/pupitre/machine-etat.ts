/**
 * État affiché par la colonne de la machine (T-050) : tout ce que l'écorché, les voyants et la jauge
 * ont besoin de connaître, indépendamment du jeu en direct. Le cas direct se construit d'après
 * {@link EtatPupitre} ({@link etatMachineDirect}) ; le curseur du trajet (T-051) construira le même
 * {@link EtatMachine} d'après le journal (`etat.journal`, voir la doc de `TripLog` pour la cabine à
 * montrer à l'indice j) et le passera à `dessinerMachine` sans rien changer d'autre.
 *
 * Fonctions pures (aucun DOM, aucun canvas). Les valeurs sont celles du jeu, jamais des différences
 * numériques recalculées.
 */
import type { Translator } from '../../i18n';
import type { EtatPupitre } from './colonne';

/** Ce que la colonne de la machine affiche. Objet réutilisable : réécrit en place, jamais copié. */
export interface EtatMachine {
  /** Hauteur du plancher de la cabine (m, sol = 0). */
  y: number;
  /** Vitesse verticale de la cabine (m/s, positive vers le haut). */
  v: number;
  /** Force demandée par le contrôleur, avant saturation (N). */
  uCmd: number;
  /** Force appliquée par le moteur, après saturation (N). */
  uSat: number;
  /** Vrai si la force demandée a été écrêtée (force demandée ≠ force appliquée). */
  sature: boolean;
  /** Voyant Marche : trajet en cours, jeu non en pause, issue pas encore atteinte. */
  marche: boolean;
  /** Voyant Pause : jeu en pause. */
  pause: boolean;
  /** Voyant Fin : issue atteinte. */
  fin: boolean;
}

/** Crée un état de machine à l'arrêt : cabine au sol, moteur coupé, aucun voyant allumé. */
export function etatMachineVide(): EtatMachine {
  return {
    y: 0,
    v: 0,
    uCmd: 0,
    uSat: 0,
    sature: false,
    marche: false,
    pause: false,
    fin: false,
  };
}

/**
 * Construit l'état de la machine du jeu en direct d'après l'état du pupitre, en réécrivant `sortie`.
 * Hauteur et vitesse de la cabine : celles de l'instantané (état après le dernier pas, celui où la
 * cabine reste figée à l'issue) ; forces et saturation : celles du dernier pas, données par le jeu.
 * Avant le lancement, l'instantané est au repos (cabine au sol, forces nulles) : la machine l'est
 * aussi.
 * @param etat état du pupitre.
 * @param sortie état de la machine à réécrire.
 * @returns `sortie`.
 */
export function etatMachineDirect(
  etat: Readonly<Pick<EtatPupitre, 'snapshot' | 'phase' | 'enPause'>>,
  sortie: EtatMachine,
): EtatMachine {
  const s = etat.snapshot;
  sortie.y = s.cabinY;
  sortie.v = s.cabinVelocity;
  sortie.uCmd = s.uCmd;
  sortie.uSat = s.uSat;
  sortie.sature = s.saturated;
  sortie.pause = etat.enPause;
  sortie.fin = s.outcome !== null;
  sortie.marche = etat.phase === 'trip' && !etat.enPause && s.outcome === null;
  return sortie;
}

/** Animation décorative d'une image : jamais de physique, seulement de l'allure. */
export interface AnimationMachine {
  /** Pulsation 0 … 1 des alertes (étincelles, voyant de saturation). */
  pulse: number;
  /** Décalage horizontal de la secousse de la carcasse en saturation (unités). */
  secousse: number;
}

/** Pulsation figée (mouvement réduit, pause) : à mi-course. */
const PULSE_FIGEE = 1;

/**
 * Animation décorative de l'image, d'après l'horloge murale. Mouvement réduit ou pause : alertes
 * figées, aucune secousse (le rotor, lui, suit la hauteur de la cabine : c'est une donnée).
 * @param maintenant instant de l'image (ms).
 * @param mouvementReduit vrai si le joueur préfère le mouvement réduit.
 * @param enPause vrai en pause.
 * @param sortie animation à réécrire.
 * @returns `sortie`.
 */
export function animationMachine(
  maintenant: number,
  mouvementReduit: boolean,
  enPause: boolean,
  sortie: AnimationMachine,
): AnimationMachine {
  if (mouvementReduit || enPause) {
    sortie.pulse = PULSE_FIGEE;
    sortie.secousse = 0;
  } else {
    sortie.pulse = 0.5 + 0.5 * Math.sin(maintenant / 70);
    sortie.secousse = Math.sin(maintenant / 23) * 1.5;
  }
  return sortie;
}

/**
 * Effort relatif du moteur, dans [0 ; 1] : |force appliquée| rapportée à la force maximale.
 * @param uSat force appliquée (N).
 * @param max force maximale (N).
 */
export function effort(uSat: number, max: number): number {
  if (!Number.isFinite(uSat) || max <= 0) {
    return 0;
  }
  const e = Math.abs(uSat) / max;
  return e > 1 ? 1 : e;
}

/** Arrondit au pas près (valeur affichée) ; 0 plutôt que −0. */
export function arrondir(valeur: number, pas: number): number {
  const r = Math.round(valeur / pas) * pas;
  return r === 0 ? 0 : r;
}

/**
 * Texte d'une force en newtons, sans unité : entier arrondi, séparateur de milliers selon la langue
 * (`5 000` en français, `5,000` en anglais), signe moins typographique.
 * @param tr traducteur.
 * @param newtons force (N).
 */
export function texteForce(tr: Translator, newtons: number): string {
  return tr.formatNumber(arrondir(newtons, 1), { maximumFractionDigits: 0 });
}

/**
 * Texte d'une hauteur en mètres, deux décimales (virgule ou point selon la langue).
 * @param tr traducteur.
 * @param metres hauteur (m).
 */
export function texteHauteur(tr: Translator, metres: number): string {
  return tr.formatNumber(arrondir(metres, 0.01), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Résumé de la machine pour les lecteurs d'écran : état, hauteur, forces, saturation. Un texte
 * complet, lisible seul ; le pupitre le met à jour à faible fréquence.
 * @param m état de la machine.
 * @param tr traducteur.
 */
export function resumeMachine(m: Readonly<EtatMachine>, tr: Translator): string {
  const etat = m.pause
    ? tr.t('pupitre.etat.paused')
    : m.fin
      ? tr.t('pupitre.etat.outcome')
      : m.marche
        ? tr.t('pupitre.etat.trip')
        : tr.t('pupitre.machine.repos');
  const base = tr.t('pupitre.machine.resume', {
    etat,
    y: texteHauteur(tr, m.y),
    appliquee: texteForce(tr, m.uSat),
    demandee: texteForce(tr, m.uCmd),
  });
  return m.sature ? `${base} ${tr.t('pupitre.machine.resumeSature')}` : base;
}
