/**
 * Curseur du trajet (T-051, décision D35) : à l'issue, le joueur reparcourt le trajet terminé d'après
 * le journal (`etat.journal`). L'état du curseur est PARTAGÉ entre la colonne des courbes (ligne,
 * poignée, valeurs lues) et celle de la machine (cabine, forces et voyants à l'instant du curseur) ;
 * il est créé une fois par {@link creerColonnesTrajet} et ne touche jamais au jeu (lecture seule : ni
 * pause, ni issue, ni instantané modifiés).
 *
 * Convention du journal (voir la doc de `TripLog`) : l'enregistrement j décrit l'instant j·dt, état
 * AVANT le pas j. Un curseur j ∈ [0 ; count] : pour j < count, tout vient de l'enregistrement j ;
 * pour j = count (fin du journal), la cabine et l'erreur viennent de l'instantané (état APRÈS le
 * dernier pas : au choc, y[count − 1] est encore sous la poutre) et les forces du dernier
 * enregistrement.
 *
 * Fonctions pures, sauf {@link creerCurseur} qui tient l'état (indice, essai).
 */
import type { LevelSnapshot, TripLog } from '../../game';
import type { EtatPupitre } from './colonne';
import { etatMachineDirect, type EtatMachine } from './machine-etat';

/** Ce qu'il faut de l'état du pupitre pour lire le journal. */
export type EtatJournal = Readonly<Pick<EtatPupitre, 'snapshot' | 'journal'>>;

/** État du curseur du trajet. */
export interface CurseurTrajet {
  /** Vrai si le curseur existe : l'issue est connue et le journal n'est pas vide. */
  readonly actif: boolean;
  /** Position du curseur, entier dans [0 ; count] (instant indice·dt). */
  readonly indice: number;
  /** Nombre d'enregistrements du journal quand le curseur est actif (0 sinon). */
  readonly count: number;
  /**
   * Met l'état à jour d'après le jeu : actif ou non, bornes, retour à la fin à chaque nouvel essai.
   * Idempotente pour une même image ; à appeler au début du dessin de chaque colonne qui lit le curseur.
   * @param etat état du pupitre.
   */
  synchroniser(etat: EtatJournal): void;
  /**
   * Place le curseur (borné dans [0 ; count], arrondi à l'entier). Sans effet si le curseur est inactif.
   * @param indice nouvelle position.
   */
  deplacer(indice: number): void;
}

/**
 * Ramène une position dans [0 ; count] (entier).
 * @param indice position demandée.
 * @param count nombre d'enregistrements.
 */
export function borneIndice(indice: number, count: number): number {
  if (Number.isNaN(indice)) {
    return Math.max(0, count);
  }
  const j = Math.round(indice);
  return j < 0 ? 0 : j > count ? Math.max(0, count) : j;
}

/**
 * Nouvelle position du curseur après une touche, ou `null` si la touche ne le concerne pas : flèches
 * ±1, Page précédente et suivante ±10, Début et Fin.
 * @param code `KeyboardEvent.code`.
 * @param indice position actuelle.
 * @param count nombre d'enregistrements.
 */
export function indiceApresTouche(code: string, indice: number, count: number): number | null {
  switch (code) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return borneIndice(indice - 1, count);
    case 'ArrowRight':
    case 'ArrowUp':
      return borneIndice(indice + 1, count);
    case 'PageDown':
      return borneIndice(indice - 10, count);
    case 'PageUp':
      return borneIndice(indice + 10, count);
    case 'Home':
      return 0;
    case 'End':
      return Math.max(0, count);
    default:
      return null;
  }
}

/** Crée le curseur (inactif jusqu'à la première synchronisation avec une issue connue). */
export function creerCurseur(): CurseurTrajet {
  let actif = false;
  let indice = 0;
  let count = 0;
  let suitLaFin = true;
  let essai = -1;
  return {
    get actif(): boolean {
      return actif;
    },
    get indice(): number {
      return indice;
    },
    get count(): number {
      return count;
    },
    synchroniser(etat): void {
      const s = etat.snapshot;
      // Un nouvel essai (ou plus d'issue) : le curseur revient à la fin, il n'y a plus de curseur.
      if (s.attempt !== essai) {
        essai = s.attempt;
        suitLaFin = true;
      }
      actif = s.outcome !== null && etat.journal.count > 0;
      if (!actif) {
        suitLaFin = true;
        count = 0;
        indice = 0;
        return;
      }
      count = etat.journal.count;
      indice = suitLaFin ? count : borneIndice(indice, count);
    },
    deplacer(nouvelIndice): void {
      if (!actif) {
        return;
      }
      suitLaFin = false;
      indice = borneIndice(nouvelIndice, count);
    },
  };
}

/** Valeurs des courbes à un instant (réécrites en place). */
export interface ValeursCourbes {
  /** Vrai si le journal est vide : aucune valeur. */
  vide: boolean;
  /** Position lue, dans [0 ; count]. */
  indice: number;
  /** Instant (s). */
  t: number;
  /** Erreur e (m). */
  e: number;
  /** Force appliquée (N). */
  uSat: number;
  /** Force demandée (N). */
  uCmd: number;
  /** Terme proportionnel (N). */
  p: number;
  /** Terme intégral (N). */
  i: number;
  /** Vitesse (m/s). */
  v: number;
  /** Accélération (m/s²). */
  a: number;
  /** Vrai si la demande a été écrêtée à cet instant. */
  sature: boolean;
}

/** Crée des valeurs vides. */
export function valeursVides(): ValeursCourbes {
  return {
    vide: true,
    indice: 0,
    t: 0,
    e: 0,
    uSat: 0,
    uCmd: 0,
    p: 0,
    i: 0,
    v: 0,
    a: 0,
    sature: false,
  };
}

/**
 * Valeurs des signaux au pas `indice` du journal (convention de la doc de `TripLog`).
 * @param journal journal du trajet.
 * @param snapshot instantané du niveau.
 * @param indice position, bornée dans [0 ; count].
 * @param sortie valeurs à réécrire (sans allocation).
 * @returns `sortie`.
 */
export function valeursAuPas(
  journal: TripLog,
  snapshot: Readonly<LevelSnapshot>,
  indice: number,
  sortie: ValeursCourbes,
): ValeursCourbes {
  const count = journal.count;
  if (count <= 0) {
    sortie.vide = true;
    sortie.indice = 0;
    sortie.t = 0;
    return sortie;
  }
  const j = borneIndice(indice, count);
  const k = j < count ? j : count - 1;
  sortie.vide = false;
  sortie.indice = j;
  sortie.t = j * journal.dt;
  sortie.uSat = journal.uSat[k] as number;
  sortie.uCmd = journal.uCmd[k] as number;
  sortie.p = journal.p[k] as number;
  sortie.i = journal.i[k] as number;
  sortie.a = journal.a[k] as number;
  sortie.sature = journal.saturated[k] === 1;
  if (j < count) {
    sortie.e = journal.e[j] as number;
    sortie.v = journal.v[j] as number;
  } else {
    sortie.e = snapshot.e;
    sortie.v = snapshot.cabinVelocity;
  }
  return sortie;
}

/**
 * État de la machine du centre à la position du curseur, d'après le journal : cabine, vitesse, forces
 * et saturation de l'enregistrement j (j = count : cabine de l'instantané, forces du dernier
 * enregistrement) ; voyant « Fin » allumé, « Marche » éteint.
 * @param etat état du pupitre.
 * @param indice position du curseur.
 * @param sortie état de la machine à réécrire.
 * @returns `sortie`.
 */
export function etatMachineAuPas(
  etat: Readonly<Pick<EtatPupitre, 'snapshot' | 'journal' | 'enPause'>>,
  indice: number,
  sortie: EtatMachine,
): EtatMachine {
  const journal = etat.journal;
  const count = journal.count;
  const s = etat.snapshot;
  const j = borneIndice(indice, count);
  const k = j < count ? j : count - 1;
  if (j < count) {
    sortie.y = journal.y[j] as number;
    sortie.v = journal.v[j] as number;
  } else {
    sortie.y = s.cabinY;
    sortie.v = s.cabinVelocity;
  }
  sortie.uCmd = journal.uCmd[k] as number;
  sortie.uSat = journal.uSat[k] as number;
  sortie.sature = journal.saturated[k] === 1;
  sortie.pause = etat.enPause;
  sortie.fin = true;
  sortie.marche = false;
  return sortie;
}

/**
 * Fabrique le `choisirEtat` de la colonne de la machine : le jeu en direct tant que le curseur est
 * inactif, l'état du journal à la position du curseur sinon.
 * @param curseur curseur partagé.
 */
export function choisirEtatMachine(
  curseur: CurseurTrajet,
): (etat: Readonly<EtatPupitre>, sortie: EtatMachine) => EtatMachine {
  return (etat, sortie) => {
    curseur.synchroniser(etat);
    if (!curseur.actif) {
      return etatMachineDirect(etat, sortie);
    }
    return etatMachineAuPas(etat, curseur.indice, sortie);
  };
}
