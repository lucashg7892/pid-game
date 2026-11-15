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
 * et 3,364391 m à Kp = 5100 (dépassement 1,79 mm). Remesuré à 1200 pas (T-022) : inchangé.
 */
export const BEAM_HEIGHT = 3.3626;

/**
 * Tolérance de marche (m) : la cabine est « au quai » si |r − y| ≤ cette valeur. Borne basse
 * de la fenêtre (D25, T-020) : à Kp = 1000 N/m, l'erreur statique m·g/Kp vaut 0,4905 m (marge 9,5 mm) ;
 * à 900 N/m, 0,545 m. Ne sert qu'au niveau 1 (voir {@link LEVEL2_ARRIVAL_TOLERANCE}).
 */
export const STEP_TOLERANCE = 0.5;

/** Tolérance de vitesse (m/s) : la cabine est « arrêtée » si |ẏ| ≤ cette valeur. */
export const SETTLE_SPEED_TOLERANCE = 0.1;

/** Nombre de pas consécutifs « au quai et arrêtée » exigés pour la victoire (120 pas = 1,0 s). */
export const WIN_HOLD_STEPS = 120;

/**
 * Durée maximale d'un trajet, en pas de simulation (1200 pas = 10 s à dt = 1/120 s, D27), pour
 * les deux niveaux. Mesures T-022 sur le jeu : au niveau 1, la victoire la plus lente de la
 * fenêtre arrive au pas 301 (Kp = 4000 et 4100 N/m), marge 899 pas ; au niveau 2, sur la grille
 * de Ki, au pas 733 (Ki = 200 N/(m·s)), marge 467 pas.
 */
export const TRIP_MAX_STEPS = 1200;

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
 * Valeur de Kp au chargement du niveau 1 (N/m), dans la fenêtre de réussite [1000 ; 5000] (D28) :
 * un lancement sans réglage gagne (pas 262, erreur finale 0,245 m, mesuré T-022).
 */
export const KP_DEFAULT = 2000;

// ─────────────────────────── Niveau 2 « La mémoire » (contrôleur PI) ────────────────────────────

/** Kp fixé du niveau 2 (N/m) : le joueur ne règle que Ki. */
export const LEVEL2_KP = 2500;

/**
 * Tolérance d'arrivée du niveau 2 (m), propre au niveau (D29, K32) : plus serrée que celle du
 * niveau 1 ({@link STEP_TOLERANCE}) pour que Ki soit nécessaire. À Kp = {@link LEVEL2_KP}, le P
 * seul (Ki = 0) s'arrête à m·g/Kp = 0,1962 m du plateau. Mesures T-022 (jeu, 1200 pas), grille de
 * Ki au pas de 100 : `step` 0 à 100, victoire 200 à 800 (contiguë), choc 900 à 8000 ; pic
 * échantillonné 3,350580 m à Ki = 800 (marge 12,02 mm sous la poutre), 3,379632 m à Ki = 900
 * (dépassement 17,03 mm). Au pas de 10 (hors grille) : `step` 0 à 120, `slow` 130, victoire 140
 * à 840 (pic 3,362216 m, marge 0,38 mm), choc dès 850.
 */
export const LEVEL2_ARRIVAL_TOLERANCE = 0.1;

/** Valeur minimale de Ki (N/(m·s)), celle de Kp. */
export const KI_MIN = KP_MIN;

/** Valeur maximale de Ki (N/(m·s)), celle de Kp. */
export const KI_MAX = KP_MAX;

/** Pas du réglage de Ki (N/(m·s)), celui de Kp. */
export const KI_STEP = KP_STEP;

/**
 * Valeur de Ki au chargement du niveau 2 (N/(m·s)), celle de Kp au niveau 1 (2000) : hors de la
 * fenêtre gagnante, un lancement sans réglage heurte la poutre (pas 57, mesuré T-022).
 */
export const KI_DEFAULT = KP_DEFAULT;

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

/**
 * Poste du bonhomme au pupitre (m) : abscisse fixe de ses pieds pendant le réglage, à gauche de la
 * console, tourné vers elle (+1). Déduite du dessin (constantes de `src/render`, que `src/game` ne
 * peut pas importer, recopiées ici) : bord gauche du pupitre à CONSOLE_X − CONSOLE_HALF_WIDTH
 * = −1 − 0,30 = −1,30 m ; demi-largeur du bonhomme debout 0,14 m (le plus large de
 * STANCE_HALF_WIDE = 0,14, HAT_BRIM_HALF = 0,13 et HEAD_RADIUS = 0,13 ; le bras tendu vers le levier
 * est fait pour passer au-dessus du pupitre) ; marge visible de 0,11 m (environ 9 px à 80 px/m,
 * cadrage 1280 × 720). D'où −1,30 − 0,14 − 0,11 = −1,55 m. Dans la zone de la console
 * ({@link CONSOLE_REACH}) et dans les bornes de la marche.
 */
export const CONSOLE_POST_X = -1.55;

/**
 * Début du pas de sortie (m) : bord droit du plancher de la cabine, CABIN_CENTER_X + CABIN_WIDTH / 2
 * = 3,8 m. Avant cette abscisse, les pieds du bonhomme sont à la hauteur finale de la cabine.
 */
export const EXIT_STEP_MIN_X = CABIN_CENTER_X + CABIN_WIDTH / 2;

/**
 * Fin du pas de sortie (m) : bord gauche du plateau d'arrivée, {@link ARRIVAL_LEDGE_MIN_X} = 4 m.
 * Au-delà, les pieds sont à la hauteur du plateau (r). Entre les deux (0,2 m, le jeu entre la
 * cabine et le plateau), la hauteur des pieds passe linéairement de l'une à l'autre.
 */
export const EXIT_STEP_MAX_X = ARRIVAL_LEDGE_MIN_X;

/**
 * Point d'arrivée de la sortie sur le plateau (m) : 0,6 m après son bord. Assez loin pour que le
 * bonhomme, bras levés compris (demi-largeur 0,25 m dans la pose de victoire du rendu), soit tout
 * entier sur le plateau (4 + 0,25 < 4,6) ; assez près pour ne pas passer sous la jauge de force,
 * dessinée au-dessus du plateau à hauteur de tête à partir de x = 5,1 m (GAUGE_MIN_X = 5,2 m moins
 * ses graduations de 0,1 m) : 4,6 + 0,25 = 4,85 < 5,1.
 */
export const EXIT_END_X = ARRIVAL_LEDGE_MIN_X + 0.6;
