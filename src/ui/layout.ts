/**
 * Disposition des panneaux de l'interface (T-010). Fonction pure : à partir de la géométrie de
 * l'écran (pixels CSS, fournie par le point de composition d'après le cadrage du rendu), calcule
 * pour chaque panneau une boîte dont il ne sort jamais (largeur fixée, hauteur maximale avec
 * défilement interne). Aucune boîte ne coupe le rectangle de la cage : rien ne masque l'ascenseur
 * ni la courbe.
 *
 * Deux dispositions :
 * - « côtés » (paysage) : panneaux de réglage, bulle et issue à gauche de la cage, au-dessus du
 *   quai de départ ; mesures du trajet à droite, au-dessus du quai d'arrivée ;
 * - « bandes » (portrait, côtés trop étroits) : bulle et mesures dans la bande au-dessus de la
 *   scène, réglage et issue dans la bande au-dessous.
 * Le bandeau d'aide est en bas de l'écran, sous la scène s'il y a la place, sinon en bas à gauche.
 */

/** Rectangle écran (pixels CSS, origine en haut à gauche). */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Point écran (pixels CSS). */
export interface ScreenXY {
  readonly x: number;
  readonly y: number;
}

/** Géométrie transmise à l'interface (données simples, sans dépendance au rendu). */
export interface UiGeometry {
  /** Largeur de la surface (pixels CSS). */
  readonly width: number;
  /** Hauteur de la surface (pixels CSS). */
  readonly height: number;
  /** Zone de jeu toujours visible. */
  readonly scene: ScreenRect;
  /** Cage d'ascenseur (colonne x ∈ [0 ; 4] m sur toute la hauteur de la zone de jeu). */
  readonly cage: ScreenRect;
  /** Pixels CSS par mètre. */
  readonly pixelsPerMeter: number;
  /** Dessus du pupitre de la console. */
  readonly console: ScreenXY;
  /** Haut de la tête du bonhomme. */
  readonly walkerHead: ScreenXY;
  /** Milieu du bord haut de la jauge de force. */
  readonly forceGauge: ScreenXY;
  /** Bord gauche, au niveau du haut de l'échelle de la jauge (« 5000 N max »). */
  readonly gaugeMax: ScreenXY;
  /** Bord gauche, au niveau du repère du poids m·g (« poids »). */
  readonly gaugeWeight: ScreenXY;
  /** Milieu de la cote d'erreur. */
  readonly errorDimension: ScreenXY;
  /** Ordonnée écran du dessus du quai d'arrivée. */
  readonly arrivalLedgeY: number;
  /** Ordonnée écran du sol du quai de départ (pieds du bonhomme). */
  readonly groundY: number;
}

/** Boîte d'un panneau : position, largeur, hauteur maximale et bord d'ancrage. */
export interface PanelBox {
  /** Bord gauche (px). */
  left: number;
  /** Largeur (px). */
  width: number;
  /** `top` : le panneau pend sous {@link edge} ; `bottom` : il pousse au-dessus de {@link edge}. */
  anchor: 'top' | 'bottom';
  /** Ordonnée du bord d'ancrage (px depuis le haut). */
  edge: number;
  /** Hauteur maximale (px) ; au-delà, défilement interne. */
  maxHeight: number;
}

/** Disposition complète, réécrite en place. */
export interface UiLayout {
  /** `sides` (paysage) ou `bands` (portrait). */
  mode: 'sides' | 'bands';
  /** Bandeau d'aide. */
  readonly banner: PanelBox;
  /** Bulle d'objectif ou d'invite. */
  readonly bubble: PanelBox;
  /** Panneau Kp. */
  readonly panel: PanelBox;
  /** Panneau d'issue. */
  readonly outcome: PanelBox;
  /** Mesures du trajet et légende. */
  readonly readout: PanelBox;
  /** Aide des commandes. */
  readonly help: PanelBox;
  /** Étiquette de force : milieu du bord bas. */
  readonly force: { x: number; y: number };
  /** Étiquette « max » : bord gauche et milieu vertical. */
  readonly gaugeMax: { x: number; y: number };
  /** Étiquette « poids » : bord gauche et milieu vertical. */
  readonly gaugeWeight: { x: number; y: number };
  /** Cote chiffrée : bord gauche et milieu vertical. */
  readonly dimension: { x: number; y: number };
}

/** Marge autour des panneaux (px). */
export const MARGIN = 12;
/** Hauteur réservée à la barre du haut (titre, Kp, boutons) (px). */
export const TOP_BAR = 56;
/**
 * Hauteur de la barre du haut en portrait étroit (px) : le titre et l'étiquette de Kp passent
 * sur deux lignes (mesuré : 76 px à 390 px de large). Le paysage garde {@link TOP_BAR}.
 */
export const TOP_BAR_PORTRAIT = 76;
/** Hauteur réservée à l'invite d'orientation sous la barre du haut, en portrait (px). */
export const ROTATE_BAR = 48;
/** Hauteur réservée au bandeau d'aide (px). */
export const BANNER_RESERVE = 76;
/**
 * Largeur réservée (px) aux étiquettes « 5000 N max » et « poids » à droite de la jauge : les
 * mesures du trajet se posent au-delà (mesuré : « 5000 N max » fait environ 75 px).
 */
export const GAUGE_LABELS_ROOM = 84;
/**
 * Hauteur (px) que l'étiquette de la jauge prend au-dessus de la scène en portrait, où le haut
 * de la jauge touche le haut de la scène : la bulle et les mesures s'arrêtent plus haut.
 */
export const GAUGE_TITLE_BAND = 18;
/** Largeur minimale d'un côté pour y poser des panneaux (px). */
export const MIN_SIDE = 240;
/** Hauteur minimale de la bande sous la scène pour y poser le bandeau (px). */
export const MIN_BANNER_BAND = 56;
/** Largeur minimale d'un panneau posé à gauche du bonhomme et de la console (px). */
export const MIN_PANEL_BESIDE = 280;
/** Demi-largeur de la boîte du bonhomme (m). */
export const WALKER_HALF_WIDTH = 0.3;
/** Demi-largeur de la boîte de la console (m). */
export const CONSOLE_HALF_BOX = 0.35;
/** Hauteur de la boîte de la console au-dessus du pupitre (levier) (m). */
export const CONSOLE_BOX_ABOVE = 0.35;
/** Largeurs maximales (px). */
export const MAX_WIDTH = Object.freeze({
  banner: 960,
  bubble: 320,
  panel: 360,
  outcome: 440,
  readout: 320,
  help: 480,
});

/** Crée une boîte vide. */
function box(): PanelBox {
  return { left: 0, width: 0, anchor: 'top', edge: 0, maxHeight: 0 };
}

/** Crée une disposition (à allouer une fois). */
export function createLayout(): UiLayout {
  return {
    mode: 'sides',
    banner: box(),
    bubble: box(),
    panel: box(),
    outcome: box(),
    readout: box(),
    help: box(),
    force: { x: 0, y: 0 },
    gaugeMax: { x: 0, y: 0 },
    gaugeWeight: { x: 0, y: 0 },
    dimension: { x: 0, y: 0 },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Remplit une boîte ; largeur et hauteur jamais négatives. */
function set(
  b: PanelBox,
  left: number,
  width: number,
  anchor: 'top' | 'bottom',
  edge: number,
  maxHeight: number,
): void {
  b.left = Math.round(left);
  b.width = Math.max(0, Math.floor(width));
  b.anchor = anchor;
  b.edge = Math.round(edge);
  b.maxHeight = Math.max(0, Math.floor(maxHeight));
}

/**
 * Place une boîte de largeur `w` centrée sur `cx`, contenue dans [minX ; maxX].
 */
function centered(cx: number, w: number, minX: number, maxX: number): number {
  return clamp(cx - w / 2, minX, maxX - w);
}

/**
 * Vrai si le bonhomme est sur le quai de départ (sa tête est à gauche de la cage).
 * @param g géométrie de l'écran.
 */
export function walkerOnLedge(g: Readonly<UiGeometry>): boolean {
  return g.walkerHead.x < g.cage.left;
}

/**
 * Pose un panneau à gauche des obstacles (bonhomme, console), du haut de l'écran jusqu'au sol,
 * s'il y a au moins {@link MIN_PANEL_BESIDE} px ; sinon au-dessus d'eux.
 */
function placeBesideOrAbove(
  b: PanelBox,
  maxWidth: number,
  g: Readonly<UiGeometry>,
  obstacleLeft: number,
  obstacleTop: number,
  leftMax: number,
): void {
  const beside = Math.min(maxWidth, obstacleLeft - MARGIN);
  if (beside >= MIN_PANEL_BESIDE) {
    const floor = g.groundY - 8;
    set(b, obstacleLeft - beside, beside, 'bottom', floor, floor - TOP_BAR);
  } else {
    const w = Math.min(maxWidth, leftMax - MARGIN);
    set(
      b,
      centered(g.console.x, w, MARGIN, leftMax),
      w,
      'bottom',
      obstacleTop,
      obstacleTop - TOP_BAR,
    );
  }
}

/**
 * Boîte écran du bonhomme (tête → pieds, 0,6 m de large), ou `null` s'il est dans la cabine.
 * Alloue : réservé aux tests.
 * @param g géométrie de l'écran.
 */
export function walkerRect(g: Readonly<UiGeometry>): ScreenRect | null {
  if (!walkerOnLedge(g)) {
    return null;
  }
  const half = WALKER_HALF_WIDTH * g.pixelsPerMeter;
  return {
    left: g.walkerHead.x - half,
    right: g.walkerHead.x + half,
    top: g.walkerHead.y,
    bottom: g.groundY,
  };
}

/**
 * Boîte écran de la console (0,7 m de large, du sol à 0,35 m au-dessus du pupitre). Alloue :
 * réservé aux tests.
 * @param g géométrie de l'écran.
 */
export function consoleRect(g: Readonly<UiGeometry>): ScreenRect {
  const half = CONSOLE_HALF_BOX * g.pixelsPerMeter;
  return {
    left: g.console.x - half,
    right: g.console.x + half,
    top: g.console.y - CONSOLE_BOX_ABOVE * g.pixelsPerMeter,
    bottom: g.groundY,
  };
}

/**
 * Calcule la disposition (fonction pure, sans allocation : réécrit `out`).
 * @param g géométrie de l'écran.
 * @param out disposition à réécrire.
 */
export function computeLayout(g: UiGeometry, out: UiLayout): UiLayout {
  const { width, height, cage, scene } = g;
  const leftMax = cage.left - MARGIN;
  const rightMin = cage.right + MARGIN;
  const leftWidth = leftMax - MARGIN;
  const rightWidth = width - MARGIN - rightMin;
  const sides = leftWidth >= MIN_SIDE && rightWidth >= MIN_SIDE;
  out.mode = sides ? 'sides' : 'bands';

  // Bandeau d'aide : sous la scène s'il y a la place, sinon en bas à gauche de la cage.
  const bandBelow = height - scene.bottom;
  if (bandBelow >= MIN_BANNER_BAND || !sides) {
    const w = Math.min(MAX_WIDTH.banner, width - 2 * MARGIN);
    const room = sides ? bandBelow - 8 : BANNER_RESERVE;
    set(out.banner, (width - w) / 2, w, 'bottom', height - 8, room);
  } else {
    // Sous le sol du quai de départ : ne couvre ni le bonhomme ni la console.
    set(out.banner, MARGIN, leftWidth, 'bottom', height - 8, height - 8 - (g.groundY + 4));
  }
  const bannerTop = height - 8 - BANNER_RESERVE;
  // Bas utilisable à droite de la cage : le haut du bandeau s'il déborde à droite de la cage.
  const rightLimit =
    out.banner.left + out.banner.width > rightMin
      ? out.banner.edge - out.banner.maxHeight - 4
      : height - MARGIN;

  // Aide des commandes : sous la barre du haut, à droite de la cage en paysage ; pleine largeur
  // dans la bande du haut en portrait.
  if (sides) {
    const w = Math.min(MAX_WIDTH.help, rightWidth);
    set(out.help, width - MARGIN - w, w, 'top', TOP_BAR, rightLimit - TOP_BAR);
  } else {
    const w = Math.min(MAX_WIDTH.help, width - 2 * MARGIN);
    set(out.help, width - MARGIN - w, w, 'top', TOP_BAR, scene.top - MARGIN - TOP_BAR);
  }

  // Étiquettes ancrées.
  out.force.x = Math.round(g.forceGauge.x);
  // Le haut de la jauge touche le haut de la scène en portrait : l'étiquette (large de ~110 px,
  // plus que la jauge) déborderait sur la cage ; on la tient au-dessus du haut de la zone de jeu.
  out.force.y = Math.round(Math.min(g.forceGauge.y - 4, scene.top - 2));
  out.gaugeMax.x = Math.round(g.gaugeMax.x);
  out.gaugeMax.y = Math.round(g.gaugeMax.y);
  out.gaugeWeight.x = Math.round(g.gaugeWeight.x);
  out.gaugeWeight.y = Math.round(g.gaugeWeight.y);
  out.dimension.x = Math.round(Math.max(g.errorDimension.x + 10, cage.right + 6));
  out.dimension.y = Math.round(g.errorDimension.y);

  if (sides) {
    // Obstacles à ne pas couvrir : la console, et le bonhomme s'il est sur le quai.
    const ppm = g.pixelsPerMeter;
    const onLedge = walkerOnLedge(g);
    const consoleLeft = g.console.x - CONSOLE_HALF_BOX * ppm;
    const consoleTop = g.console.y - CONSOLE_BOX_ABOVE * ppm;
    const obstacleLeft =
      Math.min(consoleLeft, onLedge ? g.walkerHead.x - WALKER_HALF_WIDTH * ppm : consoleLeft) -
      MARGIN;
    const obstacleTop = Math.min(consoleTop, onLedge ? g.walkerHead.y : consoleTop) - MARGIN;
    placeBesideOrAbove(out.panel, MAX_WIDTH.panel, g, obstacleLeft, obstacleTop, leftMax);
    placeBesideOrAbove(out.outcome, MAX_WIDTH.outcome, g, obstacleLeft, obstacleTop, leftMax);
    const bw = Math.min(MAX_WIDTH.bubble, leftWidth);
    const head = g.walkerHead.y - 12;
    set(
      out.bubble,
      centered(g.walkerHead.x, bw, MARGIN, leftMax),
      bw,
      'bottom',
      head,
      head - TOP_BAR,
    );
    // Mesures : à droite de la jauge de force si la place suffit, sinon sous le quai d'arrivée.
    const besideGauge = Math.max(rightMin, g.gaugeMax.x + GAUGE_LABELS_ROOM + MARGIN);
    const rw = Math.min(MAX_WIDTH.readout, width - MARGIN - besideGauge);
    const limit = rightLimit;
    if (rw >= 160) {
      const top = Math.max(TOP_BAR, g.forceGauge.y);
      set(out.readout, besideGauge, rw, 'top', top, limit - top);
    } else {
      const w = Math.min(MAX_WIDTH.readout, rightWidth);
      const top = g.arrivalLedgeY + MARGIN;
      set(out.readout, rightMin, w, 'top', top, limit - top);
    }
  } else {
    const full = width - 2 * MARGIN;
    const topBand = TOP_BAR_PORTRAIT + ROTATE_BAR;
    const bandTop = scene.top - MARGIN - topBand;
    const below = scene.bottom + MARGIN;
    const belowRoom = bannerTop - MARGIN - below;
    set(
      out.bubble,
      MARGIN,
      Math.min(MAX_WIDTH.bubble * 1.5, full),
      'bottom',
      scene.top - MARGIN - GAUGE_TITLE_BAND,
      bandTop - GAUGE_TITLE_BAND,
    );
    set(
      out.readout,
      MARGIN,
      Math.min(MAX_WIDTH.readout * 1.5, full),
      'top',
      topBand,
      bandTop - GAUGE_TITLE_BAND,
    );
    set(out.panel, MARGIN, Math.min(MAX_WIDTH.panel * 1.5, full), 'top', below, belowRoom);
    set(out.outcome, MARGIN, Math.min(MAX_WIDTH.outcome * 1.5, full), 'top', below, belowRoom);
  }
  return out;
}

/**
 * Étendue maximale d'une boîte (rectangle qu'elle peut occuper au plus).
 * @param b boîte.
 */
export function boxExtent(b: Readonly<PanelBox>): ScreenRect {
  const top = b.anchor === 'top' ? b.edge : b.edge - b.maxHeight;
  return { left: b.left, top, right: b.left + b.width, bottom: top + b.maxHeight };
}

/**
 * Vrai si deux rectangles se coupent (bords communs exclus).
 * @param a premier rectangle.
 * @param b second rectangle.
 */
export function intersects(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Demi-largeur de la zone cliquable de la console (m). */
export const CONSOLE_HIT_HALF_WIDTH = 0.6;
/** Hauteur cliquable au-dessus du pupitre (m). */
export const CONSOLE_HIT_ABOVE = 0.4;
/** Hauteur cliquable sous le pupitre, jusqu'au sol (m). */
export const CONSOLE_HIT_BELOW = 1.1;

/**
 * Vrai si un clic (pixels CSS) tombe sur la console : rectangle de 1,2 m de large, du sol à
 * 0,4 m au-dessus du pupitre.
 * @param x abscisse du clic.
 * @param y ordonnée du clic.
 * @param g géométrie de l'écran.
 */
export function isConsoleHit(x: number, y: number, g: Readonly<UiGeometry>): boolean {
  const ppm = g.pixelsPerMeter;
  return (
    ppm > 0 &&
    Math.abs(x - g.console.x) <= CONSOLE_HIT_HALF_WIDTH * ppm &&
    y >= g.console.y - CONSOLE_HIT_ABOVE * ppm &&
    y <= g.console.y + CONSOLE_HIT_BELOW * ppm
  );
}
