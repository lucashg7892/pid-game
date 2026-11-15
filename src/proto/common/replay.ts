/**
 * Lecteur pur d'un trajet de référence : l'appelant donne le temps, le lecteur rend l'échantillon.
 * Aucune horloge interne (ni `performance.now`, ni `Date`), aucun DOM, aucune allocation par
 * appel : `interpole` réécrit toujours le même objet, `plusProche` rend un échantillon du trajet.
 *
 * Temps de lecture t (s) : temps écoulé depuis le début de la lecture, fourni par l'appelant (par
 * exemple `(maintenant − début) / 1000` dans une maquette). t = 0 est le départ du trajet.
 */
import type { Echantillon, TrajetReference } from './types';

/**
 * État de la lecture à un temps t :
 * - `idle` : pas encore commencée (t < 0 ou t non nombre) ;
 * - `playing` : en cours (0 ≤ t ≤ durée ; en boucle, dès t ≥ 0 et pour toujours) ;
 * - `finished` : terminée (t > durée, sans boucle) ; le lecteur rend alors le dernier échantillon.
 */
export type EtatLecture = 'idle' | 'playing' | 'finished';

/** Options du lecteur. */
export interface OptionsLecteur {
  /** Lecture en boucle (défaut `false`) : t est ramené dans [0 ; période[. */
  readonly boucle?: boolean;
}

/** Position et vitesse de la cabine À AFFICHER (voir {@link LecteurTrajet.cabine}). */
export interface PositionCabine {
  /** Hauteur du plancher de la cabine (m). */
  readonly y: number;
  /** Vitesse verticale de la cabine (m/s). */
  readonly v: number;
}

/** Lecteur d'un trajet de référence (voir {@link creerLecteur}). */
export interface LecteurTrajet {
  /** Trajet lu. */
  readonly trajet: TrajetReference;
  /** Nombre d'échantillons (≥ 1). */
  readonly nombre: number;
  /** Durée (s) : temps du dernier échantillon, (nombre − 1)·dt. */
  readonly duree: number;
  /**
   * Période de la boucle (s) : nombre·dt, pour que le dernier échantillon dure un dt comme les
   * autres avant le retour au premier.
   */
  readonly periode: number;
  /** Vrai si la lecture boucle. */
  readonly boucle: boolean;
  /** État de la lecture au temps t (s). */
  etat(t: number): EtatLecture;
  /**
   * Temps dans le trajet (s) correspondant au temps de lecture t : 0 avant le début (t < 0 ou
   * NaN) ; sans boucle, min(t, durée) ; en boucle, t modulo la période (+∞ donne la durée).
   */
  tempsTrajet(t: number): number;
  /**
   * Indice de l'échantillon en cours au temps t : le dernier dont le temps est ≤ au temps dans le
   * trajet (à 1e-9 pas près, pour que t = j·dt donne bien j), borné à [0 ; nombre − 1].
   */
  indice(t: number): number;
  /** Échantillon le plus proche du temps t (arrondi au dt le plus proche). Aucune allocation. */
  plusProche(t: number): Readonly<Echantillon>;
  /**
   * Échantillon interpolé linéairement au temps t entre l'échantillon en cours et le suivant
   * (grandeurs numériques ; `saturated` est celui de l'échantillon en cours ; `t` est le temps
   * dans le trajet). Écrit dans un objet unique réutilisé : le copier pour le garder.
   */
  interpole(t: number): Readonly<Echantillon>;
  /**
   * Position et vitesse de la cabine à AFFICHER au temps t, comme dans le jeu : avant `pasIssue`,
   * celles de l'échantillon en cours (état au temps j·dt) ; à partir de `pasIssue`, `yFinal` et
   * `vFinal` (cabine figée sur l'issue, état APRÈS le dernier pas). Les échantillons, eux, sont
   * l'état AVANT le pas : pour dessiner la cabine, utiliser cette fonction et non `echantillon.y`.
   * Écrit dans un objet unique réutilisé : le copier pour le garder. Aucune allocation.
   */
  cabine(t: number): PositionCabine;
}

/** Échantillon modifiable, réécrit par `interpole`. */
type EchantillonMutable = { -readonly [K in keyof Echantillon]: Echantillon[K] };

/** Marge (en pas) pour qu'un temps j·dt calculé en flottants retombe bien sur l'indice j. */
const MARGE_INDICE = 1e-9;

/**
 * Crée un lecteur de trajet.
 * @param trajet trajet de référence (au moins un échantillon).
 * @param options voir {@link OptionsLecteur}.
 * @throws RangeError si le trajet n'a aucun échantillon ou si son dt n'est pas fini et > 0.
 */
export function creerLecteur(trajet: TrajetReference, options: OptionsLecteur = {}): LecteurTrajet {
  const echantillons = trajet.echantillons;
  const nombre = echantillons.length;
  const dt = trajet.dt;
  if (nombre === 0) throw new RangeError(`trajet « ${trajet.id} » sans échantillon`);
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError(`dt doit être fini et > 0 (reçu ${String(dt)})`);
  }
  const boucle = options.boucle ?? false;
  const duree = (nombre - 1) * dt;
  const periode = nombre * dt;
  const premier = echantillons[0] as Echantillon;
  const sortie: EchantillonMutable = { ...premier };
  const cabine: { -readonly [K in keyof PositionCabine]: PositionCabine[K] } = { y: 0, v: 0 };

  function tempsTrajet(t: number): number {
    if (!(t > 0)) return 0; // t ≤ 0 ou NaN
    if (!boucle) return t < duree ? t : duree;
    if (t === Infinity) return duree;
    const r = t - Math.floor(t / periode) * periode;
    return r >= 0 && r < periode ? r : 0;
  }

  /** Indice de l'échantillon en cours pour un temps dans le trajet tt ≥ 0 (donc j ≥ 0). */
  function indiceDuTemps(tt: number): number {
    const j = Math.floor(tt / dt + MARGE_INDICE);
    return j > nombre - 1 ? nombre - 1 : j;
  }

  return {
    trajet,
    nombre,
    duree,
    periode,
    boucle,
    etat(t: number): EtatLecture {
      if (!(t >= 0)) return 'idle';
      if (boucle || t <= duree) return 'playing';
      return 'finished';
    },
    tempsTrajet,
    indice: (t: number) => indiceDuTemps(tempsTrajet(t)),
    plusProche(t: number): Readonly<Echantillon> {
      const j = Math.round(tempsTrajet(t) / dt);
      return echantillons[j > nombre - 1 ? nombre - 1 : j] as Echantillon;
    },
    interpole(t: number): Readonly<Echantillon> {
      const tt = tempsTrajet(t);
      const j = indiceDuTemps(tt);
      const a = echantillons[j] as Echantillon;
      const b = echantillons[j + 1 < nombre ? j + 1 : j] as Echantillon;
      let f = tt / dt - j;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      sortie.t = tt;
      sortie.y = a.y + (b.y - a.y) * f;
      sortie.v = a.v + (b.v - a.v) * f;
      sortie.a = a.a + (b.a - a.a) * f;
      sortie.e = a.e + (b.e - a.e) * f;
      sortie.uCmd = a.uCmd + (b.uCmd - a.uCmd) * f;
      sortie.uSat = a.uSat + (b.uSat - a.uSat) * f;
      sortie.p = a.p + (b.p - a.p) * f;
      sortie.i = a.i + (b.i - a.i) * f;
      sortie.saturated = a.saturated;
      return sortie;
    },
    cabine(t: number): PositionCabine {
      const j = indiceDuTemps(tempsTrajet(t));
      if (j >= trajet.pasIssue) {
        cabine.y = trajet.yFinal;
        cabine.v = trajet.vFinal;
      } else {
        const x = echantillons[j] as Echantillon;
        cabine.y = x.y;
        cabine.v = x.v;
      }
      return cabine;
    },
  };
}
