/**
 * API d'ossature du pupitre (T-049) : ce qu'une colonne reçoit et doit fournir. Les colonnes du
 * centre (machine, T-050) et de droite (courbes, T-051) se branchent ici ; la colonne de gauche
 * (réglage) est déjà branchée (`reglage.ts`).
 *
 * Le pupitre tient DEUX canvas 2D superposés, dans le plan de `plan.ts` (1 unité = 1 px à
 * l'échelle 1, la mise à l'échelle et la densité de pixels sont déjà appliquées au contexte) :
 * - le FOND, redessiné seulement quand {@link EtatPupitre.versionFond} change (ouverture,
 *   redimensionnement, langue, niveau, mode, police chargée) : plaques, cadrans, graduations ;
 * - le VIF, effacé puis redessiné à CHAQUE image tant que le pupitre est ouvert : aiguilles,
 *   tracés, valeurs. Le pupitre ne dessine rien quand il est fermé.
 *
 * Une colonne dessine dans son rectangle, sans en sortir ({@link ColonnePupitre.dessinerFond},
 * {@link ColonnePupitre.dessiner}). Les contrôles DOM focalisables (leviers, champs, boutons) se
 * posent par-dessus avec `Pupitre.plan` : voir `pupitre.ts`.
 */
import type { LevelId, LevelSnapshot, TripLog, TuningSpec } from '../../game';
import type { Translator } from '../../i18n';
import type { ReglagePupitre } from './modele';
import type { IdColonne, RectPlan } from './plan';

/**
 * État donné aux colonnes. Objet UNIQUE réécrit en place à chaque image : à lire, jamais à
 * modifier ni à conserver (copier les nombres utiles).
 */
export interface EtatPupitre {
  /** Niveau. */
  readonly niveau: LevelId;
  /** Bornes et pas du réglage du niveau (les deux gains ont les mêmes). */
  readonly reglageSpec: Readonly<TuningSpec>;
  /** Instantané du niveau (en pause : la phase `paused` et `resumePhase`). */
  readonly snapshot: Readonly<LevelSnapshot>;
  /**
   * Journal des signaux de CHAQUE pas du trajet courant (`level.tripLog`, lecture seule) : y, v, a,
   * e, uCmd, uSat, p, i, saturated, de l'indice 0 à `count − 1` (pas j à t = j·dt). Même objet
   * pendant toute la vie du niveau ; relire `count` à chaque image. Voir la doc de `TripLog` pour
   * l'instant exact de chaque enregistrement et la cabine à afficher pour un curseur donné.
   */
  readonly journal: TripLog;
  /** Traducteur (langue courante) : tous les textes dessinés viennent de `pupitre.*` ou des clés existantes. */
  readonly traducteur: Translator;
  /** Ce que le réglage permet maintenant (mode, verrous, boutons). */
  readonly reglage: Readonly<ReglagePupitre>;
  /** Phase effective (en pause : celle qui reprendra). */
  readonly phase: LevelSnapshot['phase'];
  /** Vrai en pause. */
  readonly enPause: boolean;
  /** Vrai si le joueur préfère le mouvement réduit : pas d'animation décorative. */
  readonly mouvementReduit: boolean;
  /** Version du fond : change quand le fond doit être redessiné. */
  readonly versionFond: number;
  /** Instant de l'image (ms, `performance.now`) ; pour une animation décorative, jamais pour la physique. */
  readonly maintenant: number;
  /**
   * Annonce une phrase aux lecteurs d'écran (région `aria-live` polie du jeu). À utiliser avec
   * parcimonie : une annonce à l'issue, jamais une par pas de simulation.
   */
  annoncer(texte: string): void;
}

/** Ce que le pupitre donne à une colonne qui monte des éléments DOM dans le plan. */
export interface ContextePlan {
  /** Élément du plan : les contrôles s'y posent en unités du plan (1 unité = 1 px CSS à l'échelle 1). */
  readonly plan: HTMLElement;
  /** Échelle courante du plan (px CSS par unité) : pour convertir la position d'un pointeur. */
  readonly echelle: () => number;
  /** Traducteur (langue courante). */
  readonly traducteur: Translator;
  /** Met le pupitre à jour et le redessine tout de suite (après une commande du joueur). */
  readonly rafraichir: () => void;
}

/** Éléments DOM montés par une colonne (le pupitre les met à jour et les démonte). */
export interface MontageColonne {
  /**
   * Met les éléments à jour avant le dessin de l'image : n'écrire dans le DOM que si une valeur change.
   * @param etat état du pupitre.
   * @param rect rectangle de la colonne dans le plan.
   * @param montree vrai si la colonne est montrée (faux en mode étroit : cacher les éléments).
   */
  maj(etat: Readonly<EtatPupitre>, rect: RectPlan, montree: boolean): void;
  /** Retire les éléments. */
  detruire(): void;
}

/** Une colonne du pupitre. */
export interface ColonnePupitre {
  /** Emplacement de la colonne. */
  readonly id: IdColonne;
  /**
   * Dessine la partie FIXE de la colonne (appelée quand `etat.versionFond` change). Le contexte est
   * déjà effacé sous le plan ; ne rien dessiner hors de `rect`.
   * @param ctx contexte du canvas de fond, en unités du plan.
   * @param rect rectangle de la colonne dans le plan.
   * @param etat état du pupitre.
   */
  dessinerFond(ctx: CanvasRenderingContext2D, rect: RectPlan, etat: Readonly<EtatPupitre>): void;
  /**
   * Dessine la partie VIVE de la colonne (appelée à chaque image, canvas déjà effacé).
   * @param ctx contexte du canvas vif, en unités du plan.
   * @param rect rectangle de la colonne dans le plan.
   * @param etat état du pupitre.
   */
  dessiner(ctx: CanvasRenderingContext2D, rect: RectPlan, etat: Readonly<EtatPupitre>): void;
  /**
   * Résumé texte de la colonne pour les lecteurs d'écran (optionnel : une colonne dessinée sans
   * équivalent DOM en fournit un). Le pupitre le pose dans un élément masqué visuellement, sans
   * `aria-live`, et le relit à faible fréquence : il peut allouer, mais doit rester court.
   * @param etat état du pupitre.
   */
  resume?(etat: Readonly<EtatPupitre>): string;
  /**
   * Monte les éléments DOM de la colonne (optionnel : contrôles accessibles posés sur le dessin, comme
   * le curseur du trajet). Appelé une fois à la création du pupitre.
   * @param contexte plan, échelle, traducteur.
   */
  monter?(contexte: ContextePlan): MontageColonne;
}
