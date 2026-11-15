/**
 * Maquette A (lot B, v0.3, jetable) : plan du pupitre dans une planche fixe de 1280 × 720 px
 * (mise à l'échelle par la page), et échelles des instruments. Choix de dessin, pas de règle de jeu.
 */
import type { NiveauTrajet } from '../common/types';

/** Taille de la planche (px CSS à l'échelle 1). */
export const LARGEUR = 1280;
/** Voir {@link LARGEUR}. */
export const HAUTEUR = 720;

/** Rectangle. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Plaque du titre (en-tête, à gauche). */
export const ENTETE_TITRE: Rect = { x: 10, y: 6, w: 460, h: 54 };
/** Plaque du trajet (en-tête, au milieu). */
export const ENTETE_TRAJET: Rect = { x: 478, y: 6, w: 384, h: 54 };
/** Rangée des voyants (en-tête, à droite). */
export const ENTETE_VOYANTS: Rect = { x: 870, y: 6, w: 400, h: 54 };
/** Panneau du réglage des gains. */
export const PANNEAU_GAINS: Rect = { x: 10, y: 66, w: 308, h: 386 };
/** Panneau du chronomètre et de l'issue. */
export const PANNEAU_CHRONO: Rect = { x: 10, y: 460, w: 308, h: 250 };
/** Panneau des trois cadrans. */
export const PANNEAU_CADRANS: Rect = { x: 870, y: 66, w: 400, h: 160 };
/** Panneau du moteur en écorché. */
export const PANNEAU_MOTEUR: Rect = { x: 870, y: 232, w: 318, h: 478 };
/** Panneau de la jauge de force. */
export const PANNEAU_JAUGE: Rect = { x: 1192, y: 232, w: 78, h: 478 };

// --- Enregistreurs ------------------------------------------------------------------------------

/** Bord gauche et largeur des enregistreurs. */
export const ENREG_X = 326;
/** Voir {@link ENREG_X}. */
export const ENREG_W = 536;
/** Haut du premier enregistreur, pas vertical et hauteur d'un enregistreur. */
export const ENREG_Y0 = 66;
/** Voir {@link ENREG_Y0}. */
export const ENREG_PAS = 129;
/** Voir {@link ENREG_Y0}. */
export const ENREG_H = 123;
/** Papier : bord gauche (absolu) et bord droit. */
export const PAPIER_X0 = ENREG_X + 52;
/** Voir {@link PAPIER_X0}. */
export const PAPIER_X1 = ENREG_X + ENREG_W - 12;
/** Abscisse des plumes (instant courant). */
export const PLUME_X = PAPIER_X0 + 406;
/** Défilement du papier (px par seconde) : 3,5 s de trajet tiennent à gauche des plumes. */
export const PX_PAR_S = 114;
/** Dans un enregistreur : haut du papier, haut et bas du tracé (relatifs au haut du cadre). */
export const PAPIER_HAUT = 19;
/** Voir {@link PAPIER_HAUT}. */
export const TRACE_HAUT = 27;
/** Voir {@link PAPIER_HAUT}. */
export const TRACE_BAS = 104;
/** Voir {@link PAPIER_HAUT}. */
export const PAPIER_BAS = 120;

/** Échelle verticale d'un instrument. */
export interface Echelle {
  readonly min: number;
  readonly max: number;
  /** Pas des graduations. */
  readonly pas: number;
  /** Valeurs étiquetées. */
  readonly etiquettes: readonly number[];
}

/** Erreur e (m). */
export const ECHELLE_E: Echelle = { min: -0.5, max: 3, pas: 0.5, etiquettes: [0, 1, 2, 3] };
/** Vitesse v (m/s). */
export const ECHELLE_V: Echelle = { min: -4, max: 12, pas: 2, etiquettes: [-4, 0, 4, 8, 12] };
/** Accélération a (m/s²). */
export const ECHELLE_A: Echelle = {
  min: -80,
  max: 100,
  pas: 20,
  etiquettes: [-80, -40, 0, 40, 80],
};

/** Échelle des forces des enregistreurs 2 et 3 (kN), selon le niveau du trajet. */
export function echelleForce(niveau: NiveauTrajet): Echelle {
  return niveau === 'level2'
    ? { min: -1, max: 9, pas: 1, etiquettes: [0, 2, 4, 6, 8] }
    : { min: -2, max: 16, pas: 2, etiquettes: [0, 4, 8, 12, 16] };
}

/** Grossissement de la plume I de l'enregistreur 3 (le terme intégral est petit devant P). */
export const LOUPE_I = 5;

/** Ordonnée d'une valeur dans un enregistreur dont le cadre commence à `y0` (bornée au tracé). */
export function yTrace(y0: number, echelle: Echelle, v: number): number {
  const haut = y0 + TRACE_HAUT;
  const bas = y0 + TRACE_BAS;
  const f = (v - echelle.min) / (echelle.max - echelle.min);
  const y = bas - f * (bas - haut);
  return y < haut - 2 ? haut - 2 : y > bas + 2 ? bas + 2 : y;
}

// --- Réglage des gains -------------------------------------------------------------------------

/** Bornes et pas du réglage (N/m pour Kp, N/(m·s) pour Ki). */
export const GAIN_MAX = 8000;
/** Voir {@link GAIN_MAX}. */
export const GAIN_PAS = 100;
/** Levier : centre horizontal du levier Kp et du levier Ki. */
export const LEVIER_KP_X = 92;
/** Voir {@link LEVIER_KP_X}. */
export const LEVIER_KI_X = 236;
/** Plaque des leviers : haut et bas. */
export const LEVIER_HAUT = 116;
/** Voir {@link LEVIER_HAUT}. */
export const LEVIER_BAS = 340;
/** Fente : ordonnée du gain maximal et du gain nul. */
export const FENTE_HAUT = 134;
/** Voir {@link FENTE_HAUT}. */
export const FENTE_BAS = 322;
/** Ordonnée d'un gain sur la fente. */
export function yGain(g: number): number {
  return FENTE_BAS - (g / GAIN_MAX) * (FENTE_BAS - FENTE_HAUT);
}

// --- Cadrans ----------------------------------------------------------------------------------

/** Un cadran à aiguille. */
export interface Cadran {
  readonly cx: number;
  readonly cy: number;
  readonly rayon: number;
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly etiquettes: readonly number[];
  readonly titre: string;
  readonly unite: string;
  /** Début de la zone rouge (dépassement), ou null. */
  readonly rouge: number | null;
}

/** Angle de départ et ouverture des cadrans (rad, sens du canvas : horaire). */
export const CADRAN_A0 = (Math.PI * 3) / 4;
/** Voir {@link CADRAN_A0}. */
export const CADRAN_OUVERTURE = (Math.PI * 3) / 2;

/** Les trois cadrans : force appliquée, force demandée, vitesse. */
export const CADRANS: readonly Cadran[] = [
  {
    cx: 937,
    cy: 138,
    rayon: 54,
    min: -2,
    max: 5,
    pas: 0.5,
    etiquettes: [-2, -1, 0, 1, 2, 3, 4, 5],
    titre: 'FORCE APPLIQUÉE',
    unite: 'kN',
    rouge: 5,
  },
  {
    cx: 1070,
    cy: 138,
    rayon: 54,
    min: -2,
    max: 16,
    pas: 1,
    etiquettes: [0, 4, 8, 12, 16],
    titre: 'FORCE DEMANDÉE',
    unite: 'kN',
    rouge: 5,
  },
  {
    cx: 1203,
    cy: 138,
    rayon: 54,
    min: -4,
    max: 12,
    pas: 1,
    etiquettes: [-4, 0, 4, 8, 12],
    titre: 'VITESSE CABINE',
    unite: 'm/s',
    rouge: null,
  },
];

/** Angle d'une valeur sur un cadran (bornée à la butée). */
export function angleCadran(c: Cadran, v: number): number {
  const f = (v - c.min) / (c.max - c.min);
  const fb = f < -0.02 ? -0.02 : f > 1.02 ? 1.02 : f;
  return CADRAN_A0 + fb * CADRAN_OUVERTURE;
}

// --- Moteur en écorché ------------------------------------------------------------------------

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
/** Encoches du rotor (peu nombreuses : pas d'effet stroboscopique à 30 images/s). */
export const ENCOCHES = 8;
/** Lames du collecteur. */
export const LAMES = 8;
/** Rotation du rotor : radians par mètre de câble enroulé (arbre direct, sans réducteur). */
export const RAD_PAR_M = 1;

/** Règle de hauteur de la cabine : abscisse, haut (3,5 m) et bas (0 m). */
export const REGLE_X = 1120;
/** Voir {@link REGLE_X}. */
export const REGLE_HAUT = 478;
/** Voir {@link REGLE_X}. */
export const REGLE_BAS = 688;
/** Hauteur maximale de la règle (m). */
export const REGLE_MAX = 3.5;
/** Ordonnée d'une hauteur sur la règle. */
export function yRegle(h: number): number {
  return REGLE_BAS - (h / REGLE_MAX) * (REGLE_BAS - REGLE_HAUT);
}
/** Abscisse du câble qui descend vers la cabine. */
export const CABLE_X = 1158;
/** Ordonnée du centre de la poulie de renvoi (le câble repart à la verticale à droite). */
export const POULIE_Y = 440;

// --- Jauge de force ---------------------------------------------------------------------------

/** Jauge : bords de la colonne, haut (16 kN) et bas (−2 kN). */
export const JAUGE_X0 = 1238;
/** Voir {@link JAUGE_X0}. */
export const JAUGE_X1 = 1258;
/** Voir {@link JAUGE_X0}. */
export const JAUGE_HAUT = 316;
/** Voir {@link JAUGE_X0}. */
export const JAUGE_BAS = 676;
/** Échelle de la jauge (kN). */
export const JAUGE_MIN = -2;
/** Voir {@link JAUGE_MIN}. */
export const JAUGE_MAX = 16;
/** Ordonnée d'une force (kN) sur la jauge, bornée. */
export function yJauge(kn: number): number {
  const f = (kn - JAUGE_MIN) / (JAUGE_MAX - JAUGE_MIN);
  const fb = f < 0 ? 0 : f > 1 ? 1 : f;
  return JAUGE_BAS - fb * (JAUGE_BAS - JAUGE_HAUT);
}

// --- Chronomètre ------------------------------------------------------------------------------

/** Chronomètre : centre, rayon, et durée d'un tour (s). */
export const CHRONO_X = 82;
/** Voir {@link CHRONO_X}. */
export const CHRONO_Y = 582;
/** Voir {@link CHRONO_X}. */
export const CHRONO_R = 58;
/** Voir {@link CHRONO_X}. */
export const CHRONO_TOUR = 4;

/** Voyants de l'en-tête : abscisse du voyant, libellé. */
export const VOYANTS: readonly { readonly x: number; readonly libelle: string }[] = [
  { x: 890, libelle: 'MARCHE' },
  { x: 994, libelle: 'PAUSE' },
  { x: 1082, libelle: 'SATURATION' },
  { x: 1214, libelle: 'FIN' },
];
/** Ordonnée des voyants de l'en-tête. */
export const VOYANT_Y = 33;
