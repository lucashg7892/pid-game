/**
 * Charte crayon (direction artistique « Huygens's world », T-009) : toutes les constantes de style
 * du dessin au crayon, regroupées ici. Couleurs, épaisseurs, tremblé, hachures, mise en page du
 * décor et proportions du bonhomme. Aucune géométrie de jeu n'est inventée : les positions qui
 * comptent pour les règles (quais, cage, cabine, poutre, console) viennent de `src/game` ; celles
 * d'ici sont des choix de dessin (épaisseur d'un quai, place de la poulie, taille d'une hachure).
 *
 * Fichier pur : ni three ni DOM.
 */

/** Style d'un trait de crayon (toutes les longueurs en mètres monde). */
export interface StrokeStyle {
  /** Épaisseur nominale du trait (m). */
  readonly width: number;
  /** Encre : multiplicateur d'opacité dans [0, 1]. */
  readonly ink: number;
  /** Amplitude du tremblé de position, perpendiculaire au trait (m). */
  readonly wobble: number;
  /** Amplitude relative du tremblé d'épaisseur (fraction de l'épaisseur). */
  readonly widthJitter: number;
  /** Longueur des extrémités effilées (m) ; 0 = bouts francs. */
  readonly taper: number;
  /** Longueur maximale d'un segment avant subdivision (m) ; 0 = pas de subdivision. */
  readonly subdivide: number;
  /**
   * Variation de pression : fraction d'encre retirée au plus le long du trait (0 = encre
   * uniforme). L'encre d'un point varie dans [ink × (1 − pressure) ; ink]. Mécanisme disponible,
   * laissé à 0 dans tous les styles : l'allure actuelle est validée par l'utilisateur.
   */
  readonly pressure: number;
}

// ---------------------------------------------------------------------------------------------
// Couleurs et matériau
// ---------------------------------------------------------------------------------------------

/** Teinte du graphite (sRGB). */
export const GRAPHITE_COLOR = '#3a3a3a';
/** Opacité de base du graphite. */
export const GRAPHITE_OPACITY = 0.85;
/** Crayon rouge : seule couleur permise, réservée à la jauge de force saturée (sRGB). */
export const RED_PENCIL_COLOR = '#c23a2b';
/** Opacité du crayon rouge. */
export const RED_PENCIL_OPACITY = 0.9;
/** Taille d'une cellule de grain du graphite (m). */
export const PENCIL_GRAIN_CELL = 0.008;
/** Force du grain : fraction d'opacité retirée au plus (0 = trait uniforme). */
export const PENCIL_GRAIN_STRENGTH = 0.25;
/**
 * Gamma de la correction d'opacité perçue : les opacités de cette charte sont celles d'un mélange
 * sRGB (crayon sur papier, comme sur une feuille), alors que le renderer mélange en espace
 * linéaire ; le matériau convertit l'une en l'autre (voir `pencil-material.ts`).
 */
export const PERCEPTUAL_GAMMA = 2.2;

// ---------------------------------------------------------------------------------------------
// Tracé à l'écran (anti-crénelage)
// ---------------------------------------------------------------------------------------------

/** Épaisseur minimale d'un trait à l'écran (pixels CSS), même sur petit écran. */
export const MIN_STROKE_PX = 1.25;
/** Frange d'anti-crénelage ajoutée à chaque trait (pixels CSS, total des deux bords). */
export const STROKE_FRINGE_PX = 1;
/** Limite d'onglet des jointures : au-delà, l'onglet est écrêté (multiple de la demi-largeur). */
export const MITER_LIMIT = 3;
/** Fraction d'épaisseur gardée au bout d'une extrémité effilée. */
export const TAPER_MIN = 0.35;
/** Longueur d'onde du tremblé de position (m). */
export const WOBBLE_WAVELENGTH = 0.45;
/** Longueur d'onde du tremblé d'épaisseur (m). */
export const WIDTH_WAVELENGTH = 0.18;
/** Longueur d'onde de la variation de pression (m). */
export const PRESSURE_WAVELENGTH = 0.3;

// ---------------------------------------------------------------------------------------------
// « Boiling »
// ---------------------------------------------------------------------------------------------

/** Changements de graine du tremblé par seconde (désactivé si `prefers-reduced-motion`). */
export const BOIL_RATE_HZ = 8;
/** Nombre de graines distinctes parcourues en boucle par le boiling. */
export const BOIL_SEED_COUNT = 64;

// ---------------------------------------------------------------------------------------------
// Styles de traits
// ---------------------------------------------------------------------------------------------

/** Sol des quais : trait épais, appuyé. */
export const STYLE_GROUND: StrokeStyle = Object.freeze({
  width: 0.04,
  ink: 1,
  wobble: 0.006,
  widthJitter: 0.18,
  taper: 0.12,
  subdivide: 0.25,
  pressure: 0,
});
/** Contour ordinaire (montants, pupitre, cabine). */
export const STYLE_OUTLINE: StrokeStyle = Object.freeze({
  width: 0.03,
  ink: 0.95,
  wobble: 0.005,
  widthJitter: 0.18,
  taper: 0.08,
  subdivide: 0.25,
  pressure: 0,
});
/** Trait fin (câbles, rambarde, graduations). */
export const STYLE_THIN: StrokeStyle = Object.freeze({
  width: 0.02,
  ink: 0.85,
  wobble: 0.003,
  widthJitter: 0.15,
  taper: 0.05,
  subdivide: 0.3,
  pressure: 0,
});
/** Hachure de remplissage (masse des quais, cabine). */
export const STYLE_HATCH: StrokeStyle = Object.freeze({
  width: 0.014,
  ink: 0.55,
  wobble: 0.004,
  widthJitter: 0.2,
  taper: 0.06,
  subdivide: 0.35,
  pressure: 0,
});
/** Hachure dense de la poutre (danger) : plus appuyée. */
export const STYLE_HATCH_DANGER: StrokeStyle = Object.freeze({
  width: 0.018,
  ink: 0.85,
  wobble: 0.003,
  widthJitter: 0.2,
  taper: 0.02,
  subdivide: 0.3,
  pressure: 0,
});
/** Contour appuyé de la poutre. */
export const STYLE_DANGER_OUTLINE: StrokeStyle = Object.freeze({
  width: 0.045,
  ink: 1,
  wobble: 0.004,
  widthJitter: 0.15,
  taper: 0.05,
  subdivide: 0.25,
  pressure: 0,
});
/** Bonhomme : trait franc ; 0,042 m (+20 % en T-009b) pour que le héros ressorte. */
export const STYLE_WALKER: StrokeStyle = Object.freeze({
  width: 0.042,
  ink: 1,
  wobble: 0.003,
  widthJitter: 0.15,
  taper: 0.04,
  subdivide: 0.2,
  pressure: 0,
});
/** Plancher de la cabine : le trait le plus appuyé de la scène (il porte la mesure y). */
export const STYLE_FLOOR: StrokeStyle = Object.freeze({
  width: 0.045,
  ink: 1,
  wobble: 0.002,
  widthJitter: 0.12,
  taper: 0.06,
  subdivide: 0.3,
  pressure: 0,
});
/** Courbe y(t) : trait sans tremblé de position (la courbe reste fidèle aux mesures). */
export const STYLE_CURVE: StrokeStyle = Object.freeze({
  width: 0.03,
  ink: 1,
  wobble: 0,
  widthJitter: 0.12,
  taper: 0,
  subdivide: 0,
  pressure: 0,
});
/** Pointillés de la consigne r. */
export const STYLE_SETPOINT: StrokeStyle = Object.freeze({
  width: 0.022,
  ink: 0.9,
  wobble: 0.002,
  widthJitter: 0.1,
  taper: 0.02,
  subdivide: 0,
  pressure: 0,
});
/** Hachure fine de l'erreur e (motif distinct de la courbe pleine et des pointillés). */
export const STYLE_ERROR_HATCH: StrokeStyle = Object.freeze({
  width: 0.012,
  ink: 0.6,
  wobble: 0.002,
  widthJitter: 0.2,
  taper: 0.015,
  subdivide: 0.3,
  pressure: 0,
});
/** Cote d'atelier (flèche double, traits de rappel). */
export const STYLE_DIMENSION: StrokeStyle = Object.freeze({
  width: 0.016,
  ink: 0.95,
  wobble: 0.001,
  widthJitter: 0.1,
  taper: 0,
  subdivide: 0,
  pressure: 0,
});
/** Jauge de force : remplissage hachuré serré. */
export const STYLE_GAUGE_FILL: StrokeStyle = Object.freeze({
  width: 0.018,
  ink: 0.9,
  wobble: 0.002,
  widthJitter: 0.15,
  taper: 0.01,
  subdivide: 0,
  pressure: 0,
});

// ---------------------------------------------------------------------------------------------
// Hachures
// ---------------------------------------------------------------------------------------------

/** Angle des hachures des masses (rad, depuis l'horizontale). */
export const HATCH_ANGLE = Math.PI / 4;
/** Pas des hachures des masses (m). */
export const HATCH_SPACING = 0.14;
/** Pas des hachures de la cabine (m). */
export const CABIN_HATCH_SPACING = 0.09;
/** Pas des hachures croisées de la poutre (m). */
export const DANGER_HATCH_SPACING = 0.055;
/** Angle des hachures de l'erreur (rad) : différent des masses pour ne pas les confondre. */
export const ERROR_HATCH_ANGLE = (Math.PI * 7) / 18;
/** Pas des hachures de l'erreur (m). */
export const ERROR_HATCH_SPACING = 0.05;
/** Retrait de chaque bout de hachure (m) : le trait reste à l'intérieur de la forme. */
export const HATCH_INSET = 0.012;
/** Pas des hachures du remplissage de la jauge (m). */
export const GAUGE_HATCH_SPACING = 0.035;

// ---------------------------------------------------------------------------------------------
// Mise en page du décor (choix de dessin, en m)
// ---------------------------------------------------------------------------------------------

/** Profondeur dessinée de la masse des quais sous leur sol (m). */
export const LEDGE_MASS_BOTTOM = -1.2;
/** Fond du puits de la cage, sous la cabine au repos (m). */
export const PIT_FLOOR_Y = -0.6;
/** Haut des montants de la cage et de la traverse (m). */
export const CAGE_TOP_Y = 5.25;
/** Épaisseur de la poutre (m), au-dessus de BEAM_HEIGHT. */
export const BEAM_THICKNESS = 0.2;
/** Longueur de chaque corbeau de la poutre, depuis le montant (m). */
export const BEAM_STUB_LENGTH = 0.42;
/** Centre vertical des poulies (m). */
export const PULLEY_Y = 5.1;
/** Rayon des poulies (m). */
export const PULLEY_RADIUS = 0.1;
/** Abscisse des poulies gauche et droite (m). */
export const PULLEY_LEFT_X = 0.6;
/** Voir {@link PULLEY_LEFT_X}. */
export const PULLEY_RIGHT_X = 3.4;
/** Tambour du moteur : centre (m). */
export const MOTOR_X = 4.42;
/** Voir {@link MOTOR_X}. */
export const MOTOR_Y = 5.15;
/** Rayon du tambour du moteur (m). */
export const MOTOR_RADIUS = 0.17;
/** Jauge de force : bords gauche et droit (m). */
export const GAUGE_MIN_X = 5.2;
/** Voir {@link GAUGE_MIN_X}. */
export const GAUGE_MAX_X = 5.62;
/** Jauge de force : bas (0 N) et haut (pleine échelle) (m). */
export const GAUGE_MIN_Y = 3.55;
/** Voir {@link GAUGE_MIN_Y}. */
export const GAUGE_MAX_Y = 5.35;
/** Graduation principale de la jauge (N). */
export const GAUGE_MAJOR_STEP = 1000;
/** Graduation secondaire de la jauge (N). */
export const GAUGE_MINOR_STEP = 500;
/** Longueur des graduations principales et secondaires, à gauche du cadre (m). */
export const GAUGE_MAJOR_TICK = 0.1;
/** Voir {@link GAUGE_MAJOR_TICK}. */
export const GAUGE_MINOR_TICK = 0.05;
/** Angle des hachures du remplissage de la jauge (rad). */
export const GAUGE_HATCH_ANGLE = Math.PI / 4;
/** Taille du petit poids (repère m·g) dessiné à droite de la jauge (m). */
export const GAUGE_WEIGHT_SIZE = 0.07;
/**
 * Jauge du terme intégral I (niveau 2) : bords gauche et droit (m), à droite de la jauge de
 * force et du petit poids de son repère ; mêmes ordonnées et même échelle que la jauge de force.
 */
export const GAUGE_I_MIN_X = 6;
/** Voir {@link GAUGE_I_MIN_X}. */
export const GAUGE_I_MAX_X = 6.42;
/** Épaisseur du plateau de la cabine sous le plancher (m). */
export const CABIN_PLATE_THICKNESS = 0.1;
/** Hauteur de la rambarde au-dessus du plancher (m). */
export const RAIL_HEIGHT = 1;
/** Abscisses des poteaux de rambarde, où s'accrochent les câbles (m). */
export const RAIL_LEFT_X = 0.5;
/** Voir {@link RAIL_LEFT_X}. */
export const RAIL_RIGHT_X = 3.5;
/** Longueur des mains courantes depuis chaque poteau, vers l'intérieur (m). */
export const RAIL_TOP_LENGTH = 0.4;
/** Pointillés de la consigne : longueur d'un tiret et d'un vide (m). */
export const SETPOINT_DASH = 0.12;
/** Voir {@link SETPOINT_DASH}. */
export const SETPOINT_GAP = 0.08;
/** Cote d'erreur : abscisse de la flèche et des traits de rappel (m). */
export const DIMENSION_X = 3.68;
/** Traits de rappel de la cote : de … à … (m). */
export const DIMENSION_EXT_MIN_X = 3.55;
/** Voir {@link DIMENSION_EXT_MIN_X}. */
export const DIMENSION_EXT_MAX_X = 3.95;
/** Taille des pointes de flèche de la cote (m). */
export const DIMENSION_ARROW = 0.055;
/** Console : hauteur du pied, du pupitre (m). */
export const CONSOLE_POST_HEIGHT = 0.75;
/** Console : demi-largeur du pupitre (m). */
export const CONSOLE_HALF_WIDTH = 0.3;
/** Console : hauteur du bord haut (côté droit) du pupitre au-dessus du pied (m). */
export const CONSOLE_DESK_HIGH = 0.28;
/** Console : hauteur du bord bas (côté gauche) du pupitre au-dessus du pied (m). */
export const CONSOLE_DESK_LOW = 0.18;
/** Console : hauteur du pivot du levier au-dessus du pied, sur le plan incliné (m). */
export const CONSOLE_PIVOT_HEIGHT = 0.245;
/** Console : longueur du levier (m). */
export const CONSOLE_LEVER_LENGTH = 0.28;
/** Console : débattement du levier de part et d'autre de la verticale (rad), Kp de 0 au max. */
export const CONSOLE_LEVER_SWING = 0.7;

// ---------------------------------------------------------------------------------------------
// Courbe y(t) sur le mur de la cage
// ---------------------------------------------------------------------------------------------

/** Ordonnée de l'axe des temps, dans le puits sous la cabine au repos (m). */
export const CURVE_AXIS_Y = -0.32;
/** Demi-hauteur d'une graduation de seconde (m). */
export const CURVE_TICK_HALF = 0.05;
/** Demi-hauteur d'une graduation de 5 s (m). */
export const CURVE_TICK_HALF_MAJOR = 0.1;

// ---------------------------------------------------------------------------------------------
// Bonhomme (m)
// ---------------------------------------------------------------------------------------------

/** Rayon de la tête. */
export const HEAD_RADIUS = 0.13;
/** Cuisse et tibia (identiques). */
export const THIGH_LENGTH = 0.46;
/** Voir {@link THIGH_LENGTH}. */
export const SHIN_LENGTH = 0.46;
/** Hanche → cou. */
export const TORSO_LENGTH = 0.5;
/** Cou → centre de la tête. */
export const NECK_TO_HEAD = 0.17;
/** Cou → épaule, le long du buste. */
export const NECK_TO_SHOULDER = 0.06;
/** Bras et avant-bras. */
export const UPPER_ARM_LENGTH = 0.3;
/** Voir {@link UPPER_ARM_LENGTH}. */
export const FOREARM_LENGTH = 0.28;
/** Hauteur de la hanche pendant la marche (genoux légèrement fléchis). */
export const HIP_HEIGHT_WALK = 0.86;
/** Hanche assise (pose du choc). */
export const HIP_HEIGHT_SITTING = 0.16;
/** Longueur d'un cycle de marche complet (deux pas), en distance parcourue. */
export const STRIDE_LENGTH = 1.1;
/** Demi-amplitude du déplacement d'un pied par rapport à la hanche pendant la marche. */
export const STEP_REACH = 0.22;
/** Levée du pied en phase d'envol. */
export const STEP_LIFT = 0.09;
/** Abaissement maximal de la hanche pendant la marche. */
export const HIP_BOB = 0.025;
/** Balancement des bras pendant la marche (rad). */
export const ARM_SWING = 0.45;
/** Demi-écart des pieds debout. */
export const STANCE_HALF = 0.09;
/** Demi-écart des pieds dans les poses de victoire, de haussement d'épaules, mains aux hanches. */
export const STANCE_HALF_WIDE = 0.14;
/**
 * Hauteur de la hanche debout, jambes TENDUES et pieds écartés de ±{@link STANCE_HALF} : la
 * jambe (cuisse + tibia) est l'hypoténuse.
 */
export const HIP_HEIGHT = Math.sqrt((THIGH_LENGTH + SHIN_LENGTH) ** 2 - STANCE_HALF ** 2) - 1e-6;
/** Chapeau melon : demi-largeur du bord et rayon de la calotte. */
export const HAT_BRIM_HALF = 0.13;
/** Voir {@link HAT_BRIM_HALF}. */
export const HAT_DOME_RADIUS = 0.085;
/** Nombre de segments d'un cercle de tête ou de poulie. */
export const CIRCLE_SEGMENTS = 18;
