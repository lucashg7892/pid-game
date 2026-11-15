/**
 * Contrat entre la coque des maquettes (`coque.ts`) et chaque maquette (`a`, `b`, `c`, `d`).
 * Lot B de la v0.3 : maquettes JETABLES du pupitre de contrôle, rejouées sur les trajets de
 * référence de `common/` (jamais sur le vrai jeu). Chaque maquette exporte `creer` dans son
 * `index.ts` ; la coque la monte dans `racine`, lui donne l'horloge de rejeu et relaie les ordres.
 *
 * Réglage et lancement : la maquette dessine ses propres commandes (levier ou molette, champ
 * numérique, bouton « Lancer »). Le gain affiché est l'affaire de la maquette (valeur visuelle) ;
 * « Lancer » appelle `lancer()`, qui rejoue le trajet de référence courant depuis t = 0.
 *
 * Touches RÉSERVÉES à la coque (ne pas les utiliser dans une maquette) : `1`, `2`, `3` (choisir
 * et lancer le trajet victoire, choc, saturation), `P` (pause et reprise du rejeu), `R` (rejouer
 * le trajet courant), `H` (afficher ou masquer l'aide de la coque).
 */
import type { LecteurTrajet } from './common/replay';
import type { Echantillon, IdTrajet, TrajetReference } from './common/types';

/** Position de la cabine à afficher (voir `LecteurTrajet.cabine`). */
export interface CabineAffichee {
  readonly y: number;
  readonly v: number;
}

/** Avancement du rejeu (réécrit à chaque image dans un objet UNIQUE réutilisé : ne pas le garder). */
export interface EtatRejeu {
  /** Trajet en cours de rejeu. */
  readonly trajet: TrajetReference;
  /** Lecteur du trajet (accès à `trajet.echantillons`, à `indice(t)`, à `duree`…). */
  readonly lecteur: LecteurTrajet;
  /** `attente` : avant le lancement ; `en-cours` ; `pause` ; `fini` : fin du trajet atteinte. */
  readonly phase: 'attente' | 'en-cours' | 'pause' | 'fini';
  /** Temps de rejeu depuis le lancement (s), 0 en attente, borné à la durée du trajet. */
  readonly t: number;
  /** Indice de l'échantillon en cours (0 en attente). */
  readonly indice: number;
  /** Échantillon interpolé au temps t (signaux : erreur, force, termes P et I, vitesse…). */
  readonly echantillon: Readonly<Echantillon>;
  /** Position et vitesse de la cabine À DESSINER (figée à `yFinal` après l'issue). */
  readonly cabine: CabineAffichee;
  /** Vrai à partir de `pasIssue` : l'issue (victoire, choc…) est connue et affichable. */
  readonly issueAtteinte: boolean;
}

/** Ce que la coque donne à une maquette au montage. */
export interface Contexte {
  /** Conteneur plein écran de la maquette (au moins 1280×720 CSS px) ; fond papier crème par défaut. */
  readonly racine: HTMLElement;
  /** Les trois trajets de référence, dans l'ordre victoire, choc, saturation. */
  readonly trajets: readonly TrajetReference[];
  /** Rejoue le trajet courant depuis t = 0 (à appeler depuis le bouton « Lancer »). */
  lancer(): void;
  /** Choisit un trajet de référence (la maquette est prévenue par `charger`) sans le lancer. */
  choisirTrajet(id: IdTrajet): void;
}

/** Maquette montée. */
export interface Maquette {
  /** Un trajet vient d'être choisi (ou chargé au démarrage) : remettre la maquette en attente. */
  charger(trajet: TrajetReference): void;
  /** Appelée à CHAQUE image d'affichage avec l'état du rejeu (aucune allocation conseillée). */
  mettreAJour(etat: Readonly<EtatRejeu>): void;
  /** Libère tout (écouteurs, boucle d'animation propre, contexte graphique, DOM de la racine). */
  detruire(): void;
}

/** Fabrique exportée (`creer`) par `src/proto/<x>/index.ts`. */
export type FabriqueMaquette = (contexte: Contexte) => Maquette;

/** Module d'une maquette. */
export interface ModuleMaquette {
  readonly creer: FabriqueMaquette;
}

/** Noms des maquettes. */
export type NomMaquette = 'a' | 'b' | 'c' | 'd';

/** Message envoyé par la page `?proto=tous` aux maquettes montées en iframe (`embed=1`). */
export interface MessageCommande {
  readonly proto: 'cmd';
  readonly cmd: 'trajet' | 'pause' | 'rejouer';
  /** Pour `trajet` : l'identifiant, lancé tout de suite. */
  readonly id?: IdTrajet;
}

/** Message envoyé par une maquette en iframe à la page parente quand elle est prête. */
export interface MessagePret {
  readonly proto: 'pret';
  readonly nom: NomMaquette;
}
