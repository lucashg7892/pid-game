/**
 * Disposition des panneaux (T-010) : aucune boîte de panneau ne coupe la cage, toutes restent
 * dans l'écran, pour des fenêtres paysage, portrait et extrêmes ; clic sur la console.
 */
import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_LEDGE_HEIGHT,
  CABIN_CENTER_X,
  CONSOLE_POST_X,
  CONSOLE_X,
  START_LEDGE_HEIGHT,
  VOID_MAX_X,
  VOID_MIN_X,
  WALKER_SPAWN_X,
} from '../../src/game';
import { PLAY_ZONE, computeFrame, worldXToPixel, worldYToPixel } from '../../src/render/camera';
import { GAUGE_WEIGHT_Y } from '../../src/render/gauge';
import {
  CONSOLE_ANCHOR_Y,
  GAUGE_I_LABEL_X,
  GAUGE_LABEL_X,
  WALKER_HEAD_TOP,
} from '../../src/render/level-display';
import {
  DIMENSION_X,
  EASEL_CENTER_X,
  EASEL_HEIGHT,
  EASEL_WIDTH,
  GAUGE_I_MAX_X,
  GAUGE_I_MIN_X,
  GAUGE_MAX_X,
  GAUGE_MAX_Y,
  GAUGE_MIN_X,
} from '../../src/render/pencil-style';
import {
  GAUGE_LABELS_ROOM,
  GAUGE_TITLE_BAND,
  GAUGE_TITLE_ROW,
  boxExtent,
  computeLayout,
  consoleRect,
  createLayout,
  intersects,
  isConsoleHit,
  walkerOnLedge,
  walkerRect,
  type UiGeometry,
  type UiLayout,
} from '../../src/ui/layout';

/** Géométrie comme la calcule main.ts (même cadrage que le rendu) ; `level2` : jauge I présente. */
function geometry(
  width: number,
  height: number,
  walkerX = WALKER_SPAWN_X,
  level2 = false,
): UiGeometry {
  const f = computeFrame(width, height);
  const x = (v: number): number => worldXToPixel(f, width, v);
  const y = (v: number): number => worldYToPixel(f, height, v);
  return {
    width,
    height,
    scene: {
      left: x(PLAY_ZONE.minX),
      right: x(PLAY_ZONE.maxX),
      top: y(PLAY_ZONE.maxY),
      bottom: y(PLAY_ZONE.minY),
    },
    cage: {
      left: x(VOID_MIN_X),
      right: x(VOID_MAX_X),
      top: y(PLAY_ZONE.maxY),
      bottom: y(PLAY_ZONE.minY),
    },
    pixelsPerMeter: f.pixelsPerMeter,
    console: { x: x(CONSOLE_X), y: y(CONSOLE_ANCHOR_Y) },
    walkerHead: { x: x(walkerX), y: y(WALKER_HEAD_TOP) },
    forceGauge: { x: x((GAUGE_MIN_X + GAUGE_MAX_X) / 2), y: y(GAUGE_MAX_Y) },
    gaugeMax: { x: x(level2 ? GAUGE_I_LABEL_X : GAUGE_LABEL_X), y: y(GAUGE_MAX_Y) },
    gaugeWeight: { x: x(level2 ? GAUGE_I_LABEL_X : GAUGE_LABEL_X), y: y(GAUGE_WEIGHT_Y) },
    iGauge: { x: x((GAUGE_I_MIN_X + GAUGE_I_MAX_X) / 2), y: y(GAUGE_MAX_Y) },
    iGaugeVisible: level2,
    boardTopLeft: { x: x(EASEL_CENTER_X - EASEL_WIDTH / 2), y: y(EASEL_HEIGHT) },
    boardBottomRight: { x: x(EASEL_CENTER_X + EASEL_WIDTH / 2), y: y(START_LEDGE_HEIGHT) },
    errorDimension: { x: x(DIMENSION_X), y: y(2.9) },
    arrivalLedgeY: y(ARRIVAL_LEDGE_HEIGHT),
    groundY: y(START_LEDGE_HEIGHT),
  };
}

/**
 * Positions du bonhomme : apparition, milieu du quai, bords et milieu de la zone de la console,
 * butée droite, dans la cabine.
 */
const WALKER_POSITIONS = [WALKER_SPAWN_X, -3, -1.75, -1.6, CONSOLE_X, -0.3, CABIN_CENTER_X];

const PANELS = ['banner', 'bubble', 'panel', 'outcome', 'readout', 'help'] as const;

const SIZES: readonly (readonly [number, number])[] = [
  [1280, 720],
  [1281, 721],
  [1920, 1080],
  [1366, 768],
  [1440, 900],
  [1280, 600],
  [2560, 720],
  [1024, 768],
  [800, 900],
  [844, 390],
  [390, 844],
  [360, 740],
  [768, 1024],
];

describe('computeLayout', () => {
  for (const [w, h, level2] of SIZES.flatMap(
    ([a, b]) =>
      [
        [a, b, false],
        [a, b, true],
      ] as const,
  )) {
    it(`${String(w)}×${String(h)}${level2 ? ' (niveau 2)' : ''} : aucun panneau ne coupe la cage, la console ni le bonhomme, ni ne sort de l’écran`, () => {
      for (const walkerX of WALKER_POSITIONS) {
        const g = geometry(w, h, walkerX, level2);
        const layout = computeLayout(g, createLayout());
        for (const name of PANELS) {
          const b = layout[name];
          const extent = boxExtent(b);
          expect(intersects(extent, g.cage), `${name} ${JSON.stringify(extent)}`).toBe(false);
          expect(
            intersects(extent, consoleRect(g)),
            `${name} / console, x = ${String(walkerX)}`,
          ).toBe(false);
          const walker = walkerRect(g);
          if (walker !== null) {
            expect(intersects(extent, walker), `${name} / bonhomme, x = ${String(walkerX)}`).toBe(
              false,
            );
          }
          expect(b.width, `${name} largeur`).toBeGreaterThan(0);
          expect(extent.left, `${name} gauche`).toBeGreaterThanOrEqual(0);
          expect(extent.right, `${name} droite`).toBeLessThanOrEqual(w);
          expect(extent.top, `${name} haut`).toBeGreaterThanOrEqual(0);
          expect(extent.bottom, `${name} bas`).toBeLessThanOrEqual(h);
        }
      }
    });
  }

  it('1280×720, bonhomme à la console : réglage à sa gauche, du haut jusqu’au sol', () => {
    const g = geometry(1280, 720, -1.6);
    const l: UiLayout = computeLayout(g, createLayout());
    expect(l.mode).toBe('sides');
    expect(walkerOnLedge(g)).toBe(true);
    expect(l.panel.anchor).toBe('bottom');
    expect(l.panel.edge).toBe(Math.round(g.groundY - 8));
    expect(l.panel.left + l.panel.width).toBeLessThanOrEqual((walkerRect(g)?.left ?? 0) - 12);
    expect(l.panel.width).toBeGreaterThanOrEqual(280);
    // Bonhomme dans la cabine : l'issue est posée à gauche de la console.
    const cabin = geometry(1280, 720, CABIN_CENTER_X);
    expect(walkerRect(cabin)).toBeNull();
    const lc = computeLayout(cabin, createLayout());
    expect(lc.outcome.left + lc.outcome.width).toBeLessThanOrEqual(consoleRect(cabin).left - 12);
    expect(l.readout.left).toBeGreaterThan(g.forceGauge.x);
    expect(l.banner.edge).toBe(712);
    expect(boxExtent(l.banner).top).toBeGreaterThanOrEqual(g.scene.bottom);
    expect(l.dimension.x).toBeGreaterThan(g.cage.right);
  });

  it('390×844 : bandes ; réglage et issue sous la scène, bulle et mesures au-dessus', () => {
    const g = geometry(390, 844);
    const l = computeLayout(g, createLayout());
    expect(l.mode).toBe('bands');
    expect(boxExtent(l.panel).top).toBeGreaterThan(g.scene.bottom);
    expect(boxExtent(l.outcome).top).toBeGreaterThan(g.scene.bottom);
    expect(boxExtent(l.bubble).bottom).toBeLessThan(g.scene.top);
    expect(boxExtent(l.readout).bottom).toBeLessThan(g.scene.top);
  });

  it('667×375 : bandes sans place sous la scène, l’issue garde une hauteur utile dans l’écran', () => {
    for (const level2 of [false, true]) {
      const g = geometry(667, 375, WALKER_SPAWN_X, level2);
      const l = computeLayout(g, createLayout());
      expect(l.mode).toBe('bands');
      const extent = boxExtent(l.outcome);
      expect(l.outcome.maxHeight).toBeGreaterThanOrEqual(120);
      expect(extent.top).toBeGreaterThanOrEqual(0);
      expect(extent.bottom).toBeLessThanOrEqual(375);
    }
  });

  it('étiquettes de la jauge : posées à droite de la jauge, mesures au-delà (paysage)', () => {
    const g = geometry(1280, 720);
    const l = computeLayout(g, createLayout());
    expect(l.gaugeMax.x).toBe(Math.round(g.gaugeMax.x));
    expect(l.gaugeMax.x).toBeGreaterThan(g.forceGauge.x);
    expect(l.gaugeWeight.y).toBeGreaterThan(l.gaugeMax.y);
    expect(l.force.y).toBeLessThan(l.gaugeMax.y);
    expect(l.readout.left).toBeGreaterThanOrEqual(l.gaugeMax.x + GAUGE_LABELS_ROOM);
    // Les étiquettes (boîtes approchées : 84 px de large, 20 px de haut) ne coupent ni la cage,
    // ni la console, ni le bonhomme, ni les panneaux de la disposition.
    const tags = [l.gaugeMax, l.gaugeWeight].map((p) => ({
      left: p.x,
      right: p.x + GAUGE_LABELS_ROOM,
      top: p.y - 10,
      bottom: p.y + 10,
    }));
    for (const tag of tags) {
      expect(intersects(tag, g.cage)).toBe(false);
      expect(intersects(tag, consoleRect(g))).toBe(false);
      // L'aide est une fenêtre modale : elle couvre déjà tout ce qu'elle veut, hors sujet ici.
      for (const name of PANELS.filter((n) => n !== 'help')) {
        expect(intersects(tag, boxExtent(l[name])), name).toBe(false);
      }
    }
  });

  it('niveau 2, paysage : étiquette de la jauge I une rangée au-dessus de celle de la force, mesures plus à droite', () => {
    const g1 = geometry(1280, 720);
    const g2 = geometry(1280, 720, WALKER_SPAWN_X, true);
    const l1 = computeLayout(g1, createLayout());
    const l2 = computeLayout(g2, createLayout());
    expect(l2.iGauge.x).toBe(Math.round(g2.iGauge.x));
    expect(l2.iGauge.x).toBeGreaterThan(l2.force.x);
    expect(l2.iGauge.y).toBe(l2.force.y - GAUGE_TITLE_ROW);
    // L'échelle (« max », « poids ») est à droite de la jauge I, les mesures au-delà.
    expect(l2.gaugeMax.x).toBeGreaterThan(g2.iGauge.x);
    expect(l2.readout.left).toBeGreaterThanOrEqual(l2.gaugeMax.x + GAUGE_LABELS_ROOM);
    expect(l2.readout.left).toBeGreaterThan(l1.readout.left);
    // Les étiquettes des deux jauges ne se coupent pas (boîtes de 110 px sur 20 px).
    const box = (p: { x: number; y: number }): Parameters<typeof intersects>[0] => ({
      left: p.x - 55,
      right: p.x + 55,
      top: p.y - 20,
      bottom: p.y,
    });
    expect(intersects(box(l2.force), box(l2.iGauge))).toBe(false);
    for (const name of PANELS.filter((n) => n !== 'help')) {
      expect(intersects(box(l2.iGauge), boxExtent(l2[name])), name).toBe(false);
    }
  });

  it('niveau 2, portrait : la bulle et les mesures laissent la place aux deux rangées d’étiquettes', () => {
    const g = geometry(390, 844, WALKER_SPAWN_X, true);
    const l = computeLayout(g, createLayout());
    const top = l.iGauge.y - 20;
    expect(boxExtent(l.bubble).bottom).toBeLessThanOrEqual(top);
    expect(boxExtent(l.readout).bottom).toBeLessThanOrEqual(top);
    expect(l.iGauge.x + 55).toBeLessThanOrEqual(g.width);
    expect(l.gaugeMax.x + GAUGE_LABELS_ROOM).toBeLessThanOrEqual(g.width);
    // Niveau 1 : une seule rangée, bandes inchangées.
    const l1 = computeLayout(geometry(390, 844), createLayout());
    expect(boxExtent(l1.bubble).bottom).toBeGreaterThan(boxExtent(l.bubble).bottom);
  });

  it('portrait : la bulle et les mesures laissent la place à l’étiquette de la jauge', () => {
    const g = geometry(390, 844);
    const l = computeLayout(g, createLayout());
    const label = l.force.y - GAUGE_TITLE_BAND;
    expect(boxExtent(l.bubble).bottom).toBeLessThanOrEqual(label);
    expect(boxExtent(l.readout).bottom).toBeLessThanOrEqual(label);
    // « 5000 N max » et « poids » restent dans l'écran, à droite de la cage.
    expect(l.gaugeMax.x + GAUGE_LABELS_ROOM).toBeLessThanOrEqual(g.width);
    expect(l.gaugeMax.x).toBeGreaterThan(g.cage.right);
  });

  it('côté gauche trop étroit à gauche du bonhomme : réglage posé au-dessus de lui', () => {
    const g = geometry(1280, 720, WALKER_SPAWN_X);
    const l = computeLayout(g, createLayout());
    expect(l.panel.edge).toBeLessThanOrEqual(Math.round(g.walkerHead.y - 12));
    expect(boxExtent(l.panel).bottom).toBeLessThan(g.walkerHead.y);
  });

  it('réglage ouvert (R3) : le panneau ne dépend pas de la marche, il évite le bonhomme au poste', () => {
    for (const [w, h, level2] of [
      [1280, 720, false],
      [1280, 720, true],
      [1920, 1080, false],
      [390, 844, false],
      [390, 844, true],
    ] as const) {
      const reference = computeLayout(
        geometry(w, h, CONSOLE_POST_X, level2),
        createLayout(),
        true,
      ).panel;
      for (const walkerX of WALKER_POSITIONS) {
        const g = geometry(w, h, walkerX, level2);
        const panel = computeLayout(g, createLayout(), true).panel;
        expect(panel, `${String(w)}×${String(h)}, x = ${String(walkerX)}`).toEqual(reference);
      }
      const post = geometry(w, h, CONSOLE_POST_X, level2);
      const extent = boxExtent(reference);
      const walker = walkerRect(post);
      expect(walker).not.toBeNull();
      if (walker !== null) expect(intersects(extent, walker)).toBe(false);
      expect(intersects(extent, consoleRect(post))).toBe(false);
    }
  });

  it('réglage ouvert : l’obstacle est le poste, sans épingle il suit le bonhomme', () => {
    const live = computeLayout(geometry(1280, 720, WALKER_SPAWN_X), createLayout()).panel;
    const pinned = computeLayout(geometry(1280, 720, WALKER_SPAWN_X), createLayout(), true).panel;
    expect(pinned).not.toEqual(live);
    expect(pinned).toEqual(
      computeLayout(geometry(1280, 720, CONSOLE_POST_X), createLayout(), true).panel,
    );
  });

  it('écran trop bas pour une bande sous la scène : bandeau en bas à gauche de la cage', () => {
    const g = geometry(2560, 720);
    const l = computeLayout(g, createLayout());
    expect(l.banner.left + l.banner.width).toBeLessThanOrEqual(g.cage.left);
  });

  it('réécrit la même disposition, sans changer d’objets', () => {
    const out = createLayout();
    const banner = out.banner;
    expect(computeLayout(geometry(1280, 720), out)).toBe(out);
    expect(out.banner).toBe(banner);
  });

  it('intersects : bords communs exclus', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(intersects(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(intersects(a, { left: 9, top: 9, right: 20, bottom: 20 })).toBe(true);
    expect(boxExtent({ left: 1, width: 5, anchor: 'bottom', edge: 100, maxHeight: 30 })).toEqual({
      left: 1,
      top: 70,
      right: 6,
      bottom: 100,
    });
  });
});

describe('isConsoleHit', () => {
  it('le pupitre et le pied de la console sont cliquables, le vide à côté non', () => {
    const g = geometry(1280, 720);
    expect(isConsoleHit(g.console.x, g.console.y, g)).toBe(true);
    expect(isConsoleHit(g.console.x, g.console.y + 0.9 * g.pixelsPerMeter, g)).toBe(true);
    expect(isConsoleHit(g.console.x + g.pixelsPerMeter, g.console.y, g)).toBe(false);
    expect(isConsoleHit(g.console.x, g.console.y - g.pixelsPerMeter, g)).toBe(false);
    expect(isConsoleHit(0, 0, { ...g, pixelsPerMeter: 0 })).toBe(false);
  });
});
