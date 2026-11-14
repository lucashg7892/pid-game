/**
 * Constantes du niveau 1 « Le vide » (spec T-001 §5 et §6) : règles d'issue, bornes du
 * réglage de Kp et géométrie du décor. Unités SI : m, s, N, N/m.
 *
 * Géométrie (axe horizontal x en m, origine au bord du quai de départ, x croissant vers la
 * droite ; hauteurs en m, sol du quai de départ = 0) :
 *
 *   x : −6 ─────── quai de départ (h = 0) ─────── 0 ── vide / cage (4 m) ── 4 ── quai d'arrivée (h = 3) ── 10
 *            spawn −5,5      console −1 (zone ±0,75)    cabine centrée en 2     poutre h = 3,3626 au-dessus de la cage
 *
 * Le « vide » de 4 m est la cage d'ascenseur elle-même : la cabine (plateau de 3,6 m) comble
 * le vide au niveau du quai de départ, puis monte jusqu'au quai d'arrivée.
 */
import { ELEVATOR_PARAMS, ELEVATOR_SETPOINT } from '../sim';

// ───────────────────────────── Règles d'issue (spec §6, point 5) ─────────────────────────────

/** Consigne r du niveau (m) : hauteur du quai d'arrivée. */
export const LEVEL1_SETPOINT = ELEVATOR_SETPOINT;

/**
 * Hauteur de la poutre (m) : choc immédiat dès que la hauteur y du plancher de la cabine
 * dépasse strictement cette valeur (le bonhomme s'y cogne la tête).
 *
 * Réglée (T-020) pour que la borne haute de la fenêtre soit Kp = 5000 N/m : à peu près au
 * milieu des pics échantillonnés mesurés sur le noyau, 3,360855 m à Kp = 5000 (marge 1,74 mm)
 * et 3,364391 m à Kp = 5100 (dépassement 1,79 mm).
 */
export const BEAM_HEIGHT = 3.3626;

/**
 * Tolérance de marche (m) : la cabine est « au quai » si |r − y| ≤ cette valeur. Borne basse
 * de la fenêtre (D25, T-020) : à Kp = 1000 N/m, l'erreur statique m·g/Kp vaut 0,4905 m (marge 9,5 mm) ;
 * à 900 N/m, 0,545 m.
 */
export const STEP_TOLERANCE = 0.5;

/** Tolérance de vitesse (m/s) : la cabine est « arrêtée » si |ẏ| ≤ cette valeur. */
export const SETTLE_SPEED_TOLERANCE = 0.1;

/** Nombre de pas consécutifs « au quai et arrêtée » exigés pour la victoire (120 pas = 1,0 s). */
export const WIN_HOLD_STEPS = 120;

/**
 * Durée maximale d'un trajet, en pas de simulation (720 pas = 6 s à dt = 1/120 s, D24). La
 * victoire la plus lente de la fenêtre arrive au pas 301 (Kp = 4000 et 4100 N/m, mesuré T-020).
 */
export const TRIP_MAX_STEPS = 720;

/** Poids de la cabine, bonhomme compris : m·g (N), calculé depuis les paramètres du noyau. */
export const CABIN_WEIGHT = ELEVATOR_PARAMS.mass * ELEVATOR_PARAMS.gravity;

/**
 * Seuil de décollage m·g/r (N/m), calculé (163,5 N/m avec les valeurs de la spec) : à la fin du
 * trajet sans victoire, l'issue est `noLift` si Kp ≤ ce seuil, `step` sinon.
 */
export const NO_LIFT_KP_THRESHOLD = CABIN_WEIGHT / LEVEL1_SETPOINT;

// ─────────────────────────────── Réglage de Kp (spec §5, §6) ────────────────────────────────

/** Valeur minimale de Kp (N/m). */
export const KP_MIN = 0;

/** Valeur maximale de Kp (N/m). */
export const KP_MAX = 8000;

/** Pas du réglage de Kp (N/m) : toute valeur est arrondie au multiple le plus proche. */
export const KP_STEP = 100;

/**
 * Valeur de Kp au chargement du niveau (N/m), volontairement hors de la fenêtre de réussite
 * [1000 ; 5000] : un lancement sans réglage échoue (« trop court »).
 */
export const KP_DEFAULT = 500;

// ───────────────────────────────── Géométrie du niveau (m) ──────────────────────────────────

/** Bord gauche du décor (m). */
export const LEVEL_MIN_X = -6;

/** Bord droit du décor (m). */
export const LEVEL_MAX_X = 10;

/** Abscisse du bord gauche du quai de départ (m). */
export const START_LEDGE_MIN_X = LEVEL_MIN_X;

/** Abscisse du bord droit du quai de départ, au bord du vide (m). */
export const START_LEDGE_MAX_X = 0;

/** Hauteur du quai de départ (m) : celle de la cabine posée au sol. */
export const START_LEDGE_HEIGHT = 0;

/** Largeur du vide, occupé par la cage d'ascenseur (m). */
export const VOID_WIDTH = 4;

/** Abscisse du bord gauche du vide et de la cage (m). */
export const VOID_MIN_X = START_LEDGE_MAX_X;

/** Abscisse du bord droit du vide et de la cage (m). */
export const VOID_MAX_X = VOID_MIN_X + VOID_WIDTH;

/** Largeur du plancher de la cabine (m), un peu moins que la cage. */
export const CABIN_WIDTH = 3.6;

/** Abscisse du centre de la cabine (m) : position du bonhomme une fois monté à bord. */
export const CABIN_CENTER_X = (VOID_MIN_X + VOID_MAX_X) / 2;

/** Abscisse du bord gauche du quai d'arrivée (m). */
export const ARRIVAL_LEDGE_MIN_X = VOID_MAX_X;

/** Abscisse du bord droit du quai d'arrivée (m). */
export const ARRIVAL_LEDGE_MAX_X = LEVEL_MAX_X;

/** Hauteur du quai d'arrivée (m), égale à la consigne. */
export const ARRIVAL_LEDGE_HEIGHT = LEVEL1_SETPOINT;

/** Abscisse de la console de réglage, sur le quai de départ (m). */
export const CONSOLE_X = -1;

/** Demi-largeur de la zone d'interaction de la console (m) : |x − CONSOLE_X| ≤ cette valeur. */
export const CONSOLE_REACH = 0.75;

/** Abscisse d'apparition du bonhomme, à gauche du quai de départ (m). */
export const WALKER_SPAWN_X = -5.5;

/** Borne gauche du déplacement du bonhomme (m). */
export const WALKER_MIN_X = WALKER_SPAWN_X;

/** Borne droite du déplacement du bonhomme sur le quai de départ (m), avant le vide. */
export const WALKER_MAX_X = -0.3;

/** Vitesse de marche du bonhomme (m/s). */
export const WALKER_SPEED = 1.5;
