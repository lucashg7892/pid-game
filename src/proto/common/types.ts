/**
 * Trajets de référence des maquettes (lot B de la v0.3) : types seulement, aucun code exécuté.
 * Ces modules n'importent ni le DOM, ni le rendu, ni le jeu : les données sont autonomes et se
 * rejouent hors du jeu (lecteur de `replay.ts`). Unités SI partout : m, s, kg, N.
 */

/** Identifiant d'un trajet de référence. */
export type IdTrajet = 'victoire' | 'choc' | 'saturation';

/** Niveau qui a produit le trajet (`level1` : contrôleur P ; `level2` : PI, Kp fixé). */
export type NiveauTrajet = 'level1' | 'level2';

/**
 * Issue du trajet, valeurs de `TripOutcome` du jeu : `win` victoire, `bonk` choc contre la poutre,
 * `noLift` la cabine ne décolle pas, `step` arrêt trop bas, `slow` stabilisation trop lente.
 */
export type IssueTrajet = 'win' | 'noLift' | 'step' | 'bonk' | 'slow';

/**
 * Un échantillon, pris à l'instant t où le jeu a calculé la commande d'un pas (convention
 * `LoopSample` du noyau : état AVANT le pas). Il correspond aux champs `step*`, `uCmd`, `pTerm`,
 * `iTermUsed`, `uSat` du snapshot du jeu (pas k−1 → k, état avant intégration), et NON à
 * `cabinY`, `cabinVelocity`, `iTerm`, `e` (état après le pas). Les signaux affichés (courbes,
 * jauges) sont ceux de l'échantillon ; la CABINE se dessine avec `positionCabine` de `replay.ts`
 * (position du jeu : l'échantillon avant `pasIssue`, puis `yFinal`/`vFinal`, figée). Champs
 * cohérents entre eux :
 * e = r − y, uCmd = p + i, uSat = uCmd borné à ±uMax, saturated = (uSat ≠ uCmd),
 * a = (uSat − m·g − c·v)/m, sauf cabine posée au sol sous une force nette vers le bas (a = 0).
 */
export interface Echantillon {
  /** Temps depuis le départ du trajet (s) : t = indice·dt. */
  readonly t: number;
  /** Hauteur du plancher de la cabine y (m, sol = 0). */
  readonly y: number;
  /** Vitesse verticale ẏ (m/s, positive vers le haut). */
  readonly v: number;
  /** Accélération verticale ÿ (m/s²), donnée par le modèle (somme des forces / masse). */
  readonly a: number;
  /** Erreur e = r − y (m). */
  readonly e: number;
  /** Force demandée par le contrôleur, avant saturation (N). */
  readonly uCmd: number;
  /** Force appliquée par le moteur, après saturation (N). */
  readonly uSat: number;
  /** Terme proportionnel Kp·e (N). */
  readonly p: number;
  /** Terme intégral utilisé pour calculer uCmd (N) ; 0 au niveau 1. */
  readonly i: number;
  /** Vrai si la saturation a écrêté la commande. */
  readonly saturated: boolean;
}

/** Constantes physiques et règles du niveau, recopiées du jeu à la génération. */
export interface PhysiqueTrajet {
  /** Masse m de la cabine, bonhomme compris (kg). */
  readonly m: number;
  /** Pesanteur g (m/s²). */
  readonly g: number;
  /** Frottement visqueux c (N·s/m). */
  readonly c: number;
  /** Saturation du moteur Umax (N) : uSat ∈ [−Umax ; +Umax]. */
  readonly uMax: number;
  /** Consigne r (m) : hauteur du plateau d'arrivée. */
  readonly r: number;
  /** Hauteur de la poutre (m) : choc dès que y la dépasse strictement. */
  readonly hauteurPoutre: number;
  /** Tolérance d'arrivée du niveau (m) : |r − y| ≤ cette valeur pour gagner. */
  readonly toleranceArrivee: number;
  /** Tolérance de vitesse (m/s) : |ẏ| ≤ cette valeur pour gagner. */
  readonly toleranceVitesse: number;
}

/** Métadonnées d'un trajet (tout sauf les échantillons). */
export interface MetaTrajet {
  /** Identifiant. */
  readonly id: IdTrajet;
  /** Titre court, en français, pour les développeurs (pas un texte affiché au joueur). */
  readonly titre: string;
  /** Niveau du jeu qui l'a produit. */
  readonly niveau: NiveauTrajet;
  /** Gain proportionnel Kp (N/m). */
  readonly kp: number;
  /** Gain intégral Ki (N/(m·s)) ; 0 au niveau 1. */
  readonly ki: number;
  /** Issue du trajet. */
  readonly issue: IssueTrajet;
  /**
   * Pas de l'issue (`outcomeK` du jeu) : nombre de pas simulés. Les échantillons d'indice
   * 0 … pasIssue − 1 sont ces pas ; à partir de pasIssue, le jeu est figé sur son issue et les
   * échantillons répètent le dernier pas simulé (seul t avance).
   */
  readonly pasIssue: number;
  /** Hauteur de la cabine à l'issue, état APRÈS le dernier pas (m) : celle où elle reste figée. */
  readonly yFinal: number;
  /** Vitesse de la cabine à l'issue, état APRÈS le dernier pas (m/s) : `cabinVelocity` du jeu. */
  readonly vFinal: number;
  /** Erreur finale r − yFinal (m), `finalError` du jeu. */
  readonly erreurFinale: number;
  /** Pas d'échantillonnage dt (s) : 1/120 s, un échantillon par pas de simulation. */
  readonly dt: number;
  /** Constantes physiques et règles du niveau. */
  readonly physique: PhysiqueTrajet;
}

/** Trajet de référence : métadonnées et suite d'échantillons, du départ (t = 0) à l'issue + 1 s. */
export interface TrajetReference extends MetaTrajet {
  /** Échantillons, un par dt, dans l'ordre du temps (au moins un). */
  readonly echantillons: readonly Echantillon[];
}

/**
 * Stockage en colonnes d'un trajet (forme compacte du fichier généré) : une valeur par échantillon
 * dans chaque colonne, toutes de même longueur ; `saturated` en 0/1. Le temps n'est pas stocké :
 * t = indice·dt.
 */
export interface ColonnesTrajet {
  readonly y: readonly number[];
  readonly v: readonly number[];
  readonly a: readonly number[];
  readonly e: readonly number[];
  readonly uCmd: readonly number[];
  readonly uSat: readonly number[];
  readonly p: readonly number[];
  readonly i: readonly number[];
  readonly saturated: readonly (0 | 1)[];
}
