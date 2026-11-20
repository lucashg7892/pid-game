/**
 * Dessin de la partie « D'où vient la force ? » du tableau d'école (T-053) : quatre vignettes
 * (le ressort de P, le bocal de I au niveau 2, la butée du moteur, le bilan des forces de la
 * cabine), chacune un petit dessin SVG à la craie et quelques lignes de calcul. Chaque dessin a une
 * alternative textuelle (`role="img"` et `aria-label`) réécrite avec les valeurs. Les calculs
 * sont dans `board-forces.ts` ; ici, seulement du DOM, réécrit quand les valeurs changent.
 */
import type { LevelId } from '../game';
import type { Translator } from '../i18n';
import { arrowLength, springLength, springPoints, type ForcesModel } from './board-forces';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Vue de la partie « force » : à placer dans le tableau, puis à mettre à jour. */
export interface ForcesView {
  /** Élément racine. */
  readonly root: HTMLElement;
  /** Réécrit les dessins et les textes d'après les grandeurs ; sans effet si elles n'ont pas changé. */
  update(model: Readonly<ForcesModel>): void;
}

type Attrs = Readonly<Record<string, string | number>>;

function svgEl<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Attrs,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, String(value));
  }
  parent?.append(node);
  return node;
}

function setAttrs(node: Element, attrs: Attrs): void {
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, String(value));
  }
}

/** Texte SVG (étiquette de dessin). */
function label(
  doc: Document,
  parent: Element,
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end' = 'start',
): SVGTextElement {
  const node = svgEl(
    doc,
    'text',
    { x, y, 'text-anchor': anchor, class: 'ui-board-svg-text' },
    parent,
  );
  node.textContent = text;
  return node;
}

/** Fait pointer une flèche (corps et pointe) de (x, y0) vers (x, y1) ; masquée si trop courte. */
function setArrow(
  body: SVGLineElement,
  head: SVGPolylineElement,
  x: number,
  y0: number,
  y1: number,
): void {
  const length = y1 - y0;
  const visible = Math.abs(length) >= 1;
  body.style.display = visible ? '' : 'none';
  head.style.display = visible ? '' : 'none';
  if (!visible) {
    return;
  }
  const dir = Math.sign(length);
  setAttrs(body, { x1: x, y1: y0, x2: x, y2: y1 });
  head.setAttribute(
    'points',
    `${String(x - 4)},${String(y1 - dir * 7)} ${String(x)},${String(y1)} ${String(x + 4)},${String(y1 - dir * 7)}`,
  );
}

/** Carte : titre, introduction, dessin, lignes de calcul. */
interface Card {
  readonly node: HTMLElement;
  readonly svg: SVGSVGElement;
  readonly lines: readonly HTMLElement[];
}

/** Même clé de comparaison pour toutes les grandeurs du modèle. */
const MODEL_KEYS = [
  'level2',
  'started',
  'error',
  'kp',
  'p',
  'ki',
  'integral',
  'jarFill',
  'i',
  'uCmd',
  'uSat',
  'uMax',
  'saturated',
  'velocity',
  'friction',
  'net',
  'acceleration',
  'grounded',
] as const satisfies readonly (keyof ForcesModel)[];

/**
 * Crée la vue.
 * @param doc document.
 * @param tr traducteur (langue courante au moment de la construction ; reconstruire si elle change).
 * @param levelId niveau : le bocal n'existe qu'au niveau 2.
 */
export function createForcesView(doc: Document, tr: Translator, levelId: LevelId): ForcesView {
  const level2 = levelId === 'level2';
  const num = (value: number, digits = 0): string =>
    tr.formatNumber(value, { maximumFractionDigits: digits });
  const root = doc.createElement('div');
  root.className = 'ui-board-forces-view';

  // Motif de hachures, partagé par les dessins (référencé par `url(#…)`).
  const defs = svgEl(
    doc,
    'svg',
    { width: 0, height: 0, 'aria-hidden': 'true', class: 'ui-board-defs' },
    root,
  );
  const pattern = svgEl(
    doc,
    'pattern',
    {
      id: 'board-hatch',
      width: 5,
      height: 5,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    },
    svgEl(doc, 'defs', {}, defs),
  );
  svgEl(doc, 'line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'ui-board-hatch-line' }, pattern);

  const idle = doc.createElement('p');
  idle.className = 'ui-board-text ui-board-forces-idle';
  idle.textContent = tr.t('board.forces.idle');
  root.append(idle);

  const grid = doc.createElement('div');
  grid.className = 'ui-board-forces-grid';
  root.append(grid);

  const card = (kind: string, title: string, intro: string, lineCount: number): Card => {
    const node = doc.createElement('div');
    node.className = `ui-board-card ui-board-card-${kind}`;
    const heading = doc.createElement('h4');
    heading.textContent = title;
    const p = doc.createElement('p');
    p.className = 'ui-board-text ui-board-small';
    p.textContent = intro;
    const svg = svgEl(doc, 'svg', { viewBox: '0 0 240 100', role: 'img', class: 'ui-board-svg' });
    node.append(heading, p, svg);
    const lines: HTMLElement[] = [];
    for (let n = 0; n < lineCount; n += 1) {
      const line = doc.createElement('p');
      line.className = 'ui-board-calc';
      node.append(line);
      lines.push(line);
    }
    grid.append(node);
    return { node, svg, lines };
  };

  // --- P : le ressort ---------------------------------------------------------------------
  const spring = card('p', tr.t('board.forces.p.title'), tr.t('board.forces.p.intro'), 2);
  svgEl(
    doc,
    'rect',
    { x: 12, y: 18, width: 8, height: 54, fill: 'url(#board-hatch)', class: 'ui-board-stroke' },
    spring.svg,
  );
  svgEl(
    doc,
    'line',
    { x1: 20, y1: 14, x2: 20, y2: 76, class: 'ui-board-stroke ui-board-thick' },
    spring.svg,
  );
  const SPRING_REST = 50;
  svgEl(
    doc,
    'line',
    {
      x1: 20 + SPRING_REST,
      y1: 28,
      x2: 20 + SPRING_REST,
      y2: 80,
      class: 'ui-board-stroke ui-board-dash',
    },
    spring.svg,
  );
  const springZigzag = svgEl(
    doc,
    'polyline',
    { class: 'ui-board-stroke ui-board-thick' },
    spring.svg,
  );
  const springEnd = svgEl(doc, 'circle', { cy: 45, r: 3.5, class: 'ui-board-stroke' }, spring.svg);
  const springDim = svgEl(doc, 'line', { y1: 84, y2: 84, class: 'ui-board-stroke' }, spring.svg);
  const springDimText = label(doc, spring.svg, 'e', 0, 96, 'middle');
  label(doc, spring.svg, 'P', 224, 38, 'middle');
  svgEl(
    doc,
    'line',
    { x1: 214, y1: 45, x2: 234, y2: 45, class: 'ui-board-stroke ui-board-thick' },
    spring.svg,
  );
  svgEl(
    doc,
    'polyline',
    { points: '226,41 234,45 226,49', class: 'ui-board-stroke ui-board-thick' },
    spring.svg,
  );

  // --- I : le bocal ----------------------------------------------------------------------
  let jarFillRect: SVGRectElement | null = null;
  let jarLevel: SVGLineElement | null = null;
  let jar: Card | null = null;
  const JAR_TOP = 14;
  const JAR_HEIGHT = 70;
  if (level2) {
    jar = card('i', tr.t('board.forces.i.title'), tr.t('board.forces.i.intro'), 2);
    jarFillRect = svgEl(
      doc,
      'rect',
      { x: 92, width: 56, fill: 'url(#board-hatch)', class: 'ui-board-stroke' },
      jar.svg,
    );
    jarLevel = svgEl(doc, 'line', { x1: 92, x2: 148, class: 'ui-board-stroke' }, jar.svg);
    svgEl(
      doc,
      'polyline',
      {
        points: `90,${String(JAR_TOP)} 90,${String(JAR_TOP + JAR_HEIGHT)} 150,${String(JAR_TOP + JAR_HEIGHT)} 150,${String(JAR_TOP)}`,
        class: 'ui-board-stroke ui-board-thick',
      },
      jar.svg,
    );
    svgEl(
      doc,
      'line',
      { x1: 150, y1: JAR_TOP + 6, x2: 156, y2: JAR_TOP + 6, class: 'ui-board-stroke' },
      jar.svg,
    );
    label(doc, jar.svg, '1 m·s', 160, JAR_TOP + 10);
    label(doc, jar.svg, 'I', 70, JAR_TOP + JAR_HEIGHT / 2 + 5, 'middle');
  }

  // --- Butée du moteur --------------------------------------------------------------------
  const stop = card('stop', tr.t('board.forces.stop.title'), '', 3);
  const stopIntro = stop.node.querySelector('p');
  const ZERO = 24;
  const RULER = 190;
  const SCALE_MAX = 1.6;
  svgEl(
    doc,
    'line',
    { x1: ZERO, y1: 8, x2: ZERO, y2: 88, class: 'ui-board-stroke ui-board-dash' },
    stop.svg,
  );
  const stopWall = svgEl(
    doc,
    'rect',
    {
      y: 12,
      width: 8,
      height: 72,
      fill: 'url(#board-hatch)',
      class: 'ui-board-stroke ui-board-wall',
    },
    stop.svg,
  );
  const stopWallText = label(doc, stop.svg, 'Umax', 0, 8, 'middle');
  const demandedLine = svgEl(
    doc,
    'line',
    { y1: 34, y2: 34, class: 'ui-board-stroke ui-board-thick ui-board-dash-wide' },
    stop.svg,
  );
  const demandedHead = svgEl(
    doc,
    'polyline',
    { class: 'ui-board-stroke ui-board-thick' },
    stop.svg,
  );
  const appliedRect = svgEl(
    doc,
    'rect',
    { y: 56, height: 14, fill: 'url(#board-hatch)', class: 'ui-board-stroke ui-board-wall' },
    stop.svg,
  );
  label(doc, stop.svg, 'u', 20, 38, 'end');
  label(doc, stop.svg, 'usat', 20, 67, 'end');
  const px = (force: number, uMax: number): number =>
    ZERO + (Math.max(-0.1 * uMax, Math.min(SCALE_MAX * uMax, force)) / (SCALE_MAX * uMax)) * RULER;

  // --- Bilan des forces -------------------------------------------------------------------
  const balance = card('bal', tr.t('board.forces.bal.title'), tr.t('board.forces.bal.intro'), 4);
  const CAB_X = 95;
  const CAB_W = 50;
  const CAB_TOP = 38;
  const CAB_BOTTOM = 62;
  svgEl(
    doc,
    'rect',
    {
      x: CAB_X,
      y: CAB_TOP,
      width: CAB_W,
      height: CAB_BOTTOM - CAB_TOP,
      fill: 'url(#board-hatch)',
      class: 'ui-board-stroke ui-board-thick',
    },
    balance.svg,
  );
  const arrow = (cls: string): { body: SVGLineElement; head: SVGPolylineElement } => ({
    body: svgEl(doc, 'line', { class: `ui-board-stroke ui-board-thick ${cls}` }, balance.svg),
    head: svgEl(doc, 'polyline', { class: `ui-board-stroke ui-board-thick ${cls}` }, balance.svg),
  });
  const motorArrow = arrow('ui-board-motor');
  const weightArrow = arrow('');
  const frictionArrow = arrow('');
  const motorX = CAB_X + CAB_W / 2;
  const weightX = CAB_X + 10;
  const frictionX = CAB_X + CAB_W - 10;
  const motorText = label(doc, balance.svg, 'T', motorX + 8, 20);
  label(doc, balance.svg, 'm·g', weightX - 6, 90, 'end');
  const frictionText = label(doc, balance.svg, 'c·v', frictionX + 8, 90);
  frictionText.style.display = 'none';

  // --- Mise à jour ------------------------------------------------------------------------
  let last: Readonly<ForcesModel> | null = null;
  const same = (a: Readonly<ForcesModel>, b: Readonly<ForcesModel>): boolean =>
    MODEL_KEYS.every((key) => a[key] === b[key]);

  const update = (m: Readonly<ForcesModel>): void => {
    if (last !== null && same(last, m)) {
      return;
    }
    last = m;
    idle.hidden = m.started;
    const e = num(m.error, 3);

    // P.
    const end = 20 + springLength(m.error, SPRING_REST, 22, 14);
    springZigzag.setAttribute('points', springPoints(20, end, 45));
    setAttrs(springEnd, { cx: end + 3 });
    const restX = 20 + SPRING_REST;
    const dimFrom = Math.min(restX, end);
    const dimTo = Math.max(restX, end);
    setAttrs(springDim, { x1: dimFrom, x2: dimTo });
    springDim.style.display = dimTo - dimFrom > 3 ? '' : 'none';
    setAttrs(springDimText, { x: (dimFrom + dimTo) / 2 });
    springDimText.style.display = dimTo - dimFrom > 3 ? '' : 'none';
    spring.svg.setAttribute('aria-label', tr.t('board.forces.p.alt', { e, p: num(m.p) }));
    setText(spring.lines[0], tr.t('board.forces.p.error', { e }));
    setText(spring.lines[1], tr.t('board.forces.p.line', { kp: num(m.kp), e, p: num(m.p) }));

    // I.
    if (jar !== null && jarFillRect !== null && jarLevel !== null) {
      const height = m.jarFill * (JAR_HEIGHT - 4);
      const top = JAR_TOP + JAR_HEIGHT - height - 1;
      setAttrs(jarFillRect, { y: top, height });
      jarFillRect.style.display = height > 0.5 ? '' : 'none';
      setAttrs(jarLevel, { y1: top, y2: top });
      jarLevel.style.display = height > 0.5 ? '' : 'none';
      const s = num(m.integral, 2);
      jar.svg.setAttribute(
        'aria-label',
        tr.t('board.forces.i.alt', { fill: num(m.jarFill * 100), i: num(m.i) }),
      );
      setText(jar.lines[0], tr.t('board.forces.i.integral', { s }));
      setText(jar.lines[1], tr.t('board.forces.i.line', { ki: num(m.ki), s, i: num(m.i) }));
    }

    // Butée.
    setText(stopIntro, tr.t('board.forces.stop.intro', { umax: num(m.uMax) }));
    const wallX = px(m.uMax, m.uMax);
    setAttrs(stopWall, { x: wallX });
    setAttrs(stopWallText, { x: wallX + 4 });
    stop.svg.classList.toggle('is-saturated', m.saturated);
    const demandedX = px(m.uCmd, m.uMax);
    setAttrs(demandedLine, { x1: ZERO, x2: demandedX });
    const dir = demandedX >= ZERO ? 1 : -1;
    demandedHead.setAttribute(
      'points',
      `${String(demandedX - dir * 7)},30 ${String(demandedX)},34 ${String(demandedX - dir * 7)},38`,
    );
    const appliedX = px(m.uSat, m.uMax);
    setAttrs(appliedRect, { x: Math.min(ZERO, appliedX), width: Math.abs(appliedX - ZERO) });
    stop.svg.setAttribute(
      'aria-label',
      tr.t('board.forces.stop.alt', { umax: num(m.uMax), ucmd: num(m.uCmd), usat: num(m.uSat) }),
    );
    setText(stop.lines[0], tr.t('board.forces.stop.demanded', { ucmd: num(m.uCmd) }));
    setText(stop.lines[1], tr.t('board.forces.stop.applied', { usat: num(m.uSat) }));
    setText(
      stop.lines[2],
      m.saturated
        ? tr.t('board.forces.stop.lost', { lost: num(m.clipped) })
        : tr.t('board.forces.stop.ok'),
    );
    stop.lines[2]?.classList.toggle('is-saturated', m.saturated);

    // Bilan.
    const up = -arrowLength(m.uSat, m.uMax, 32);
    setArrow(motorArrow.body, motorArrow.head, motorX, CAB_TOP, CAB_TOP + up);
    const down = arrowLength(m.weight, m.uMax, 34);
    setArrow(weightArrow.body, weightArrow.head, weightX, CAB_BOTTOM, CAB_BOTTOM + down);
    const drag = arrowLength(m.friction, m.uMax, 34);
    // Frottement c·v > 0 : il retient la cabine qui monte, donc il tire vers le bas.
    if (drag >= 0) {
      setArrow(frictionArrow.body, frictionArrow.head, frictionX, CAB_BOTTOM, CAB_BOTTOM + drag);
    } else {
      setArrow(frictionArrow.body, frictionArrow.head, frictionX, CAB_TOP, CAB_TOP + drag);
    }
    frictionText.style.display = Math.abs(drag) >= 1 ? '' : 'none';
    setAttrs(motorText, { y: Math.max(12, CAB_TOP + up / 2 + 4) });
    motorText.style.display = Math.abs(up) >= 1 ? '' : 'none';
    balance.svg.setAttribute(
      'aria-label',
      tr.t('board.forces.bal.alt', { usat: num(m.uSat), w: num(m.weight), f: num(m.friction) }),
    );
    setText(balance.lines[0], tr.t('board.forces.bal.motor', { usat: num(m.uSat) }));
    setText(
      balance.lines[1],
      tr.t('board.forces.bal.weight', {
        m: num(m.mass),
        g: num(m.weight / m.mass, 2),
        w: num(m.weight),
      }),
    );
    setText(
      balance.lines[2],
      tr.t('board.forces.bal.friction', {
        c: num(m.damping),
        v: num(m.velocity, 2),
        f: num(m.friction),
      }),
    );
    setText(
      balance.lines[3],
      m.grounded
        ? tr.t('board.forces.bal.ground')
        : tr.t('board.forces.bal.net', {
            net: num(m.net),
            m: num(m.mass),
            a: num(m.acceleration, 1),
          }),
    );
  };

  return { root, update };
}

/** Écrit un texte dans un élément (absent : sans effet) ; masque l'élément s'il est vide. */
function setText(node: HTMLElement | null | undefined, text: string): void {
  if (node === null || node === undefined) {
    return;
  }
  node.textContent = text;
  node.hidden = text === '';
}
