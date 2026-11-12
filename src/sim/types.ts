/**
 * Contrats du noyau de simulation (spec T-001 §4). Unités SI partout : m, s, kg, N.
 * Ce module ne contient que des types : aucun code exécuté.
 */

/** Système continu dx/dt = f(x, u), à état de dimension fixe. */
export interface PlantModel {
  /** Nombre de composantes de l'état x (sans unité). */
  readonly stateSize: number;
  /**
   * Écrit dans `out` la dérivée de l'état dx/dt (unités de x par seconde) pour la commande `u`
   * (N pour l'ascenseur). Ne doit rien allouer ni modifier `x`.
   */
  derivative(x: Readonly<Float64Array>, u: number, out: Float64Array): void;
  /** Grandeur mesurée y (m pour l'ascenseur) à partir de l'état. */
  output(x: Readonly<Float64Array>): number;
  /** Applique en place les contraintes physiques (contact sol, par exemple). */
  constrain(x: Float64Array): void;
}

/** Contrôleur à temps discret. */
export interface Controller {
  /** Remet l'état interne du contrôleur à zéro. */
  reset(): void;
  /**
   * Calcule la commande (N) à partir de la consigne `r` (m), de la mesure `y` (m) et du pas
   * `dt` (s).
   */
  update(r: number, y: number, dt: number): number;
}

/** Bornes de l'actionneur, en N : on doit avoir min ≤ max. */
export interface Saturation {
  /** Borne basse de la commande (N). */
  readonly min: number;
  /** Borne haute de la commande (N). */
  readonly max: number;
}

/** Schéma d'intégration à pas fixe, sans allocation, commande constante pendant le pas. */
export interface Integrator {
  /**
   * Avance l'état `x` en place d'un pas `dt` (s), la commande `u` étant maintenue constante
   * pendant tout le pas (bloqueur d'ordre zéro).
   */
  step(m: PlantModel, x: Float64Array, u: number, dt: number): void;
}

/** Instantané d'un pas de boucle fermée. */
export interface LoopSample {
  /** Indice entier du pas (sans unité). */
  k: number;
  /** Temps de simulation t = k·dt (s). */
  t: number;
  /** Consigne (m). */
  r: number;
  /** Mesure (m). */
  y: number;
  /** Erreur e = r − y (m). */
  e: number;
  /** Commande demandée par le contrôleur (N). */
  uCmd: number;
  /** Commande appliquée après saturation (N). */
  uSat: number;
  /** Vrai si la saturation a modifié la commande. */
  saturated: boolean;
  /** État après le pas (unités du modèle). */
  x: Readonly<Float64Array>;
}

/** Configuration d'une boucle fermée (implémentée en T-004). */
export interface ClosedLoopConfig {
  /** Modèle du système. */
  plant: PlantModel;
  /** Contrôleur. */
  controller: Controller;
  /** Bornes de l'actionneur (N). */
  saturation: Saturation;
  /** Intégrateur. */
  integrator: Integrator;
  /** Pas de simulation (s). */
  dt: number;
  /** État initial. */
  x0: Float64Array;
  /** Consigne (m) en fonction du temps t (s). */
  setpoint: (t: number) => number;
}

/** Boucle fermée pas à pas (implémentée en T-004). */
export interface ClosedLoop {
  /** Remet la boucle dans son état initial (k = 0, x = x0). */
  reset(): void;
  /** Exécute un pas et renvoie son instantané. */
  step(): LoopSample;
  /** Vrai si le contrôleur est actif (sinon uCmd = 0). */
  readonly enabled: boolean;
  /** Active ou désactive le contrôleur. */
  setEnabled(on: boolean): void;
}

/** Horloge à accumulateur : convertit des durées d'image en nombre de pas fixes. */
export interface FixedStepClock {
  /** Pas de simulation (s). */
  readonly dt: number;
  /** Ajoute la durée d'une image (s) et renvoie le nombre de pas à exécuter. */
  advance(frameSeconds: number): number;
  /** Reste de l'accumulateur divisé par dt, dans [0, 1), pour interpoler l'affichage. */
  readonly alpha: number;
}

/** Nom d'un signal enregistrable. */
export type SignalName = 'r' | 'y' | 'e' | 'uSat';

/** Enregistreur de signaux à tampon circulaire préalloué. */
export interface SignalRecorder {
  /** Nombre maximal d'échantillons conservés. */
  readonly capacity: number;
  /** Ajoute un échantillon ; à capacité atteinte, écrase le plus ancien. */
  push(s: LoopSample): void;
  /** Parcourt un signal du plus ancien au plus récent : `fn(t en s, valeur)`. */
  forEach(name: SignalName, fn: (t: number, v: number) => void): void;
  /** Nombre d'échantillons actuellement conservés (≤ capacity). */
  readonly length: number;
}
