/**
 * Plan de la colonne du centre, « la machine » (T-050) : l'écorché du moteur du treuil, sa règle de
 * hauteur, la rangée de voyants et la jauge de force. Géométrie et échelles reprises de la maquette A
 * du lot B (v0.3), nettoyées ; aucun import de `src/proto`. Fonctions pures, sans DOM ni canvas.
 *
 * Les coordonnées de l'écorché sont celles de la maquette (le moteur occupe un panneau de
 * {@link PANNEAU_MOTEUR_W} × {@link PANNEAU_H} unités dont le coin haut gauche est en
 * ({@link ORIGINE_X}, {@link ORIGINE_Y})) ; {@link decalage} les ramène dans le rectangle de la
 * colonne par une simple translation : le dessin est donc identique à la maquette.
 */
import { BEAM_HEIGHT, ELEVATOR_MAX_FORCE, LEVEL1_SETPOINT } from '../../game';
import type { RectPlan } from './plan';

/** Abscisse, dans les coordonnées de la maquette, du bord gauche du panneau du moteur. */
export const ORIGINE_X = 870;
/** Ordonnée, dans les coordonnées de la maquette, du haut des panneaux du moteur et de la jauge. */
export const ORIGINE_Y = 232;
/** Largeur du panneau du moteur (unités). */
export const PANNEAU_MOTEUR_W = 318;
/** Hauteur des panneaux du moteur et de la jauge (unités). */
export const PANNEAU_H = 496;
/** Hauteur de la rangée de voyants (unités). */
export const VOYANTS_H = 56;
/** Espace entre les plaques (unités). */
export const ESPACE = 8;

/** Rectangle d'une plaque de la colonne. */
export type Plaque = RectPlan;

/** Disposition de la colonne dans son rectangle. */
export interface DispositionMachine {
  /** Rangée des voyants. */
  readonly voyants: Plaque;
  /** Panneau du moteur en écorché. */
  readonly moteur: Plaque;
  /** Panneau de la jauge de force. */
  readonly jauge: Plaque;
  /** Translation qui amène les coordonnées de la maquette (écorché, règle) dans la colonne. */
  readonly dx: number;
  /** Idem, verticale. */
  readonly dy: number;
}

/**
 * Disposition de la colonne dans son rectangle.
 * @param r rectangle de la colonne dans le plan.
 */
export function disposition(r: Readonly<RectPlan>): DispositionMachine {
  const yPanneaux = r.y + VOYANTS_H + ESPACE;
  return {
    voyants: { x: r.x, y: r.y, w: r.w, h: VOYANTS_H },
    moteur: { x: r.x, y: yPanneaux, w: PANNEAU_MOTEUR_W, h: PANNEAU_H },
    jauge: {
      x: r.x + PANNEAU_MOTEUR_W + ESPACE,
      y: yPanneaux,
      w: r.w - PANNEAU_MOTEUR_W - ESPACE,
      h: PANNEAU_H,
    },
    dx: r.x - ORIGINE_X,
    dy: yPanneaux - ORIGINE_Y,
  };
}

// --- Voyants ----------------------------------------------------------------------------------

/** Un voyant de la rangée : abscisse relative au bord gauche de la plaque, rayon de la lampe. */
export interface PositionVoyant {
  /** Abscisse du centre de la lampe, depuis le bord gauche de la rangée. */
  readonly x: number;
  /** Clé du libellé. */
  readonly cle:
    | 'pupitre.machine.voyant.marche'
    | 'pupitre.machine.voyant.pause'
    | 'pupitre.machine.voyant.saturation'
    | 'pupitre.machine.voyant.fin';
}

/** Les quatre voyants, dans l'ordre : Marche, Pause, Saturation, Fin. */
export const VOYANTS: readonly [PositionVoyant, PositionVoyant, PositionVoyant, PositionVoyant] = [
  { x: 36, cle: 'pupitre.machine.voyant.marche' },
  { x: 152, cle: 'pupitre.machine.voyant.pause' },
  { x: 262, cle: 'pupitre.machine.voyant.saturation' },
  { x: 452, cle: 'pupitre.machine.voyant.fin' },
];
/** Rayon du verre d'un voyant (unités). */
export const VOYANT_R = 10;

// --- Moteur en écorché (coordonnées de la maquette) -----------------------------------------------

/** Axe de la vue de côté (ordonnée de l'arbre). */
export const AXE_Y = 348;
/** Rotor (vue de côté) : bords et rayon. */
export const ROTOR_X0 = 920;
/** Voir {@link ROTOR_X0}. */
export const ROTOR_X1 = 994;
/** Voir {@link ROTOR_X0}. */
export const ROTOR_R = 25;
/** Collecteur (vue de côté) : bords et rayon. */
export const COLLECTEUR_X0 = 1004;
/** Voir {@link COLLECTEUR_X0}. */
export const COLLECTEUR_X1 = 1024;
/** Voir {@link COLLECTEUR_X0}. */
export const COLLECTEUR_R = 14;
/** Tambour (vue de côté) : bords et rayon. */
export const TAMBOUR_X0 = 1094;
/** Voir {@link TAMBOUR_X0}. */
export const TAMBOUR_X1 = 1168;
/** Voir {@link TAMBOUR_X0}. */
export const TAMBOUR_R = 36;
/** Tronçon d'arbre visible entre le moteur et le tambour (jauge de torsion). */
export const ARBRE_X0 = 1046;
/** Voir {@link ARBRE_X0}. */
export const ARBRE_X1 = 1078;
/** Rayon de l'arbre. */
export const ARBRE_R = 6;
/** Coupe A-A : centre et rayons (carcasse, pôles, rotor, arbre). */
export const COUPE_X = 958;
/** Voir {@link COUPE_X}. */
export const COUPE_Y = 588;
/** Voir {@link COUPE_X}. */
export const COUPE_R_CARCASSE = 76;
/** Voir {@link COUPE_X}. */
export const COUPE_R_CARCASSE_INT = 64;
/** Voir {@link COUPE_X}. */
export const COUPE_R_POLE = 46;
/** Voir {@link COUPE_X}. */
export const COUPE_R_ROTOR = 40;
/** Voir {@link COUPE_X}. */
export const COUPE_R_ARBRE = 8;
/** Encoches du rotor (peu nombreuses : pas d'effet stroboscopique à 60 images/s). */
export const ENCOCHES = 8;
/** Lames du collecteur. */
export const LAMES = 8;

/**
 * Rotation du rotor : radians par mètre de câble enroulé. Arbre direct, sans réducteur : un mètre
 * de câble fait tourner le tambour d'un radian, ce qui revient à un rayon de tambour de 1 m. Valeur
 * de la maquette A, gardée telle quelle : le rayon est cosmétique, il n'entre dans aucune équation
 * du jeu. (Un tambour réaliste de 0,17 m tournerait à plus de 5 rad/m, soit plus de 30 rad/s à
 * 5 m/s : trop vite pour huit encoches vues à 60 images/s, d'où l'effet de roue qui tourne à
 * l'envers.)
 */
export const RAD_PAR_M = 1;

/** Règle de hauteur de la cabine : abscisse, haut (3,5 m) et bas (0 m). */
export const REGLE_X = 1120;
/** Voir {@link REGLE_X}. */
export const REGLE_HAUT = 478;
/** Voir {@link REGLE_X}. */
export const REGLE_BAS = 688;
/** Hauteur maximale graduée de la règle (m). */
export const REGLE_MAX = 3.5;
/**
 * Hauteur maximale à laquelle la cabine est dessinée (m) : un peu au-dessus de la règle pour que la
 * cabine finale d'un choc (≈ 3,44 m) ne soit jamais coupée, sans monter plus haut que la poulie.
 */
export const CABINE_MAX = 3.7;
/** Abscisse du câble qui descend vers la cabine. */
export const CABLE_X = 1158;
/** Ordonnée du centre de la poulie de renvoi (le câble repart à la verticale à droite). */
export const POULIE_Y = 440;
/** Largeur de câble enroulé par mètre sur le tambour (unités par mètre, cosmétique). */
export const ENROULE_PAR_M = 17;

/**
 * Ordonnée d'une hauteur sur la règle (coordonnées de la maquette).
 * @param h hauteur de la cabine (m).
 */
export function yRegle(h: number): number {
  return REGLE_BAS - (h / REGLE_MAX) * (REGLE_BAS - REGLE_HAUT);
}

/**
 * Hauteur dessinée de la cabine : bornée à [0 ; {@link CABINE_MAX}], 0 pour une valeur non finie.
 * @param y hauteur donnée par le jeu (m).
 */
export function hauteurAffichee(y: number): number {
  if (!Number.isFinite(y) || y <= 0) {
    return 0;
  }
  return y > CABINE_MAX ? CABINE_MAX : y;
}

/**
 * Angle du rotor (rad) : fonction de la seule hauteur de la cabine (câble enroulé sur le tambour),
 * donc il avance avec la simulation et jamais avec l'horloge murale.
 * @param y hauteur de la cabine (m).
 */
export function angleRotor(y: number): number {
  return hauteurAffichee(y) * RAD_PAR_M;
}

/** Hauteur de la poutre sur la règle (m), celle du jeu. */
export const HAUTEUR_POUTRE = BEAM_HEIGHT;
/** Consigne r (m), celle du jeu. */
export const CONSIGNE = LEVEL1_SETPOINT;
/** Taille des textes de la colonne (unités) : 16 au moins, comme le reste du pupitre. */
export const TAILLE_TEXTE = 16;
/** Bord droit du moteur, du câble et de la règle dans les coordonnées de la maquette. */
export const BORD_DROIT_X = 1184;

// --- Jauge de force ---------------------------------------------------------------------------

/** Force maximale du moteur (N) : la force appliquée reste dans ±FORCE_MAX. */
export const FORCE_MAX = ELEVATOR_MAX_FORCE;
/** Bas de l'échelle de la jauge (N) : un peu sous −Umax. */
export const JAUGE_MIN = -6000;
/** Haut de l'échelle de la jauge (N) : la demande plus grande est tronquée par une flèche. */
export const JAUGE_MAX = 14000;
/** Pas des petits traits (N) et des chiffres (N) de la jauge. */
export const JAUGE_TRAIT = 1000;
/** Voir {@link JAUGE_TRAIT}. */
export const JAUGE_CHIFFRE = 5000;
/** Haut de la colonne de la jauge, relatif au haut du panneau (unités). */
export const JAUGE_HAUT_REL = 152;
/** Bas de la colonne de la jauge, relatif au haut du panneau (unités) : 16 unités par kN. */
export const JAUGE_BAS_REL = 472;
/** Colonne de la jauge : bords gauche et droit, relatifs au bord gauche du panneau. */
export const JAUGE_X0_REL = 84;
/** Voir {@link JAUGE_X0_REL}. */
export const JAUGE_X1_REL = 108;

/** Colonne de la jauge dans le plan. */
export interface GeometrieJauge {
  /** Bords gauche et droit de la colonne. */
  readonly x0: number;
  /** Voir `x0`. */
  readonly x1: number;
  /** Haut de la colonne (valeur {@link JAUGE_MAX}). */
  readonly haut: number;
  /** Bas de la colonne (valeur {@link JAUGE_MIN}). */
  readonly bas: number;
}

/**
 * Colonne de la jauge dans un panneau.
 * @param p panneau de la jauge.
 */
export function geometrieJauge(p: Readonly<Plaque>): GeometrieJauge {
  return {
    x0: p.x + JAUGE_X0_REL,
    x1: p.x + JAUGE_X1_REL,
    haut: p.y + JAUGE_HAUT_REL,
    bas: p.y + JAUGE_BAS_REL,
  };
}

/**
 * Position d'une force sur la jauge, dans [0 ; 1] (0 en bas), bornée.
 * @param newtons force (N).
 */
export function fractionJauge(newtons: number): number {
  if (!Number.isFinite(newtons)) {
    return 0;
  }
  const f = (newtons - JAUGE_MIN) / (JAUGE_MAX - JAUGE_MIN);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/**
 * Ordonnée d'une force sur la jauge, bornée aux extrémités de la colonne.
 * @param g colonne de la jauge.
 * @param newtons force (N).
 */
export function yJauge(g: Readonly<GeometrieJauge>, newtons: number): number {
  return g.bas - fractionJauge(newtons) * (g.bas - g.haut);
}

/** Dépassement d'une force par rapport à l'échelle : `haut`, `bas` ou `aucun`. */
export type Depassement = 'haut' | 'bas' | 'aucun';

/**
 * Dit si une force sort de l'échelle de la jauge (la demande de 25 000 N, par exemple).
 * @param newtons force (N).
 */
export function depassement(newtons: number): Depassement {
  if (newtons > JAUGE_MAX) {
    return 'haut';
  }
  if (newtons < JAUGE_MIN) {
    return 'bas';
  }
  return 'aucun';
}
