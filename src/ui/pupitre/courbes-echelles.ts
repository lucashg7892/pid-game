/**
 * Échelles fixes des courbes du pupitre (T-051, décision D35) : une table typée unique par niveau.
 * Les échelles ne dépendent pas du trajet (on ne le connaît pas d'avance en direct) : elles couvrent
 * les trajets de tous les réglages permis (mesurés sur 197 réglages par le validateur du lot B).
 * Une valeur qui sort de l'échelle est écrêtée au bord de la bande, avec un chevron (jamais ignorée).
 *
 * Fonctions pures : aucun DOM, aucun canvas.
 */
import { TRIP_MAX_STEPS, type LevelId } from '../../game';
import type { Translator } from '../../i18n';

/** Échelle d'un signal : bornes, pas du quadrillage, pas des chiffres, décimales du nombre lu. */
export interface EchelleSignal {
  /** Borne basse (bas de la bande). */
  readonly min: number;
  /** Borne haute (haut de la bande). */
  readonly max: number;
  /** Écart entre deux traits majeurs du quadrillage (un trait fin au milieu). */
  readonly pas: number;
  /** Écart entre deux chiffres de l'axe (multiple de `pas`). */
  readonly chiffreTousLes: number;
  /** Nombre de décimales de la valeur lue en direct. */
  readonly decimales: number;
}

/** Échelles des quatre enregistreurs d'un niveau. */
export interface EchellesCourbes {
  /** Axe du temps commun : durée maximale d'un trajet (s), pas des traits (s), pas des chiffres (s). */
  readonly temps: { readonly max: number; readonly pas: number; readonly chiffreTousLes: number };
  /** Erreur e (m). */
  readonly erreur: EchelleSignal;
  /** Force du moteur (N) : appliquée, demandée, et termes P et I au niveau 2. */
  readonly commande: EchelleSignal;
  /** Vitesse v (m/s). */
  readonly vitesse: EchelleSignal;
  /** Accélération a (m/s²). */
  readonly acceleration: EchelleSignal;
  /** Vrai si les termes P et I sont tracés séparément (niveau 2). */
  readonly termesPI: boolean;
}

/** Durée maximale d'un trajet (s) : TRIP_MAX_STEPS pas de 1/120 s. */
export const DUREE_MAX_S = 10;

const TEMPS = { max: DUREE_MAX_S, pas: 1, chiffreTousLes: 2 } as const;
const ERREUR: EchelleSignal = { min: -0.5, max: 3, pas: 0.5, chiffreTousLes: 1, decimales: 2 };
const VITESSE: EchelleSignal = { min: -4, max: 12, pas: 2, chiffreTousLes: 4, decimales: 1 };

/** Table des échelles par niveau (seule source des bornes affichées). */
export const ECHELLES: Readonly<Record<LevelId, EchellesCourbes>> = Object.freeze({
  level1: {
    temps: TEMPS,
    erreur: ERREUR,
    commande: { min: -5000, max: 25000, pas: 5000, chiffreTousLes: 10000, decimales: 0 },
    vitesse: VITESSE,
    acceleration: { min: -100, max: 100, pas: 25, chiffreTousLes: 100, decimales: 1 },
    termesPI: false,
  },
  level2: {
    temps: TEMPS,
    erreur: ERREUR,
    commande: { min: -2500, max: 10000, pas: 2500, chiffreTousLes: 5000, decimales: 0 },
    vitesse: VITESSE,
    acceleration: { min: -50, max: 100, pas: 25, chiffreTousLes: 50, decimales: 1 },
    termesPI: true,
  },
});

/** Position d'une valeur dans une bande : fraction bornée et sens du dépassement. */
export interface PositionEchelle {
  /** Fraction dans [0 ; 1] (0 au bas de la bande). */
  fraction: number;
  /** −1 sous l'échelle, +1 au-dessus, 0 dedans. */
  ecrete: -1 | 0 | 1;
}

/**
 * Position d'une valeur sur une échelle, écrêtée aux bords (une valeur non finie tombe au bas).
 * @param echelle échelle du signal.
 * @param valeur valeur.
 * @param sortie résultat à réécrire (sans allocation).
 * @returns `sortie`.
 */
export function positionSurEchelle(
  echelle: Readonly<Pick<EchelleSignal, 'min' | 'max'>>,
  valeur: number,
  sortie: PositionEchelle,
): PositionEchelle {
  if (Number.isNaN(valeur)) {
    sortie.fraction = 0;
    sortie.ecrete = 0;
    return sortie;
  }
  const f = (valeur - echelle.min) / (echelle.max - echelle.min);
  if (f < 0) {
    sortie.fraction = 0;
    sortie.ecrete = -1;
  } else if (f > 1) {
    sortie.fraction = 1;
    sortie.ecrete = 1;
  } else {
    sortie.fraction = f;
    sortie.ecrete = 0;
  }
  return sortie;
}

/**
 * Fraction [0 ; 1] d'une valeur sur une échelle, écrêtée (version sans sens de dépassement).
 * @param echelle échelle du signal.
 * @param valeur valeur.
 */
export function fractionSurEchelle(
  echelle: Readonly<Pick<EchelleSignal, 'min' | 'max'>>,
  valeur: number,
): number {
  const f = (valeur - echelle.min) / (echelle.max - echelle.min);
  return Number.isNaN(f) || f < 0 ? 0 : f > 1 ? 1 : f;
}

/** Nombre de pas du temps sur l'axe (le journal en a au plus `TRIP_MAX_STEPS`). */
export const PAS_MAX = TRIP_MAX_STEPS;

/**
 * Valeurs de l'axe (traits) d'une échelle, du bas vers le haut, avec le drapeau « chiffre ».
 * @param echelle échelle.
 * @returns tableau de {valeur, chiffre}.
 */
export function graduationsEchelle(
  echelle: Readonly<EchelleSignal>,
): { valeur: number; chiffre: boolean }[] {
  const sortie: { valeur: number; chiffre: boolean }[] = [];
  const n = Math.round((echelle.max - echelle.min) / echelle.pas);
  for (let k = 0; k <= n; k += 1) {
    const valeur = echelle.min + k * echelle.pas;
    const rang = valeur / echelle.chiffreTousLes;
    sortie.push({ valeur, chiffre: Math.abs(rang - Math.round(rang)) < 1e-9 });
  }
  return sortie;
}

/** Arrondit au pas près (0 plutôt que −0). */
function arrondirAuPas(valeur: number, pas: number): number {
  const r = Math.round(valeur / pas) * pas;
  return r === 0 ? 0 : r;
}

/**
 * Texte d'une valeur de courbe, sans unité : décimales fixes (virgule ou point selon la langue),
 * signe moins typographique, jamais « −0 ».
 * @param tr traducteur.
 * @param valeur valeur.
 * @param decimales nombre de décimales (0 à 3).
 */
export function texteValeur(tr: Translator, valeur: number, decimales: number): string {
  return tr.formatNumber(arrondirAuPas(valeur, 10 ** -decimales), {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
