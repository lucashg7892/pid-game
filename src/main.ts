/**
 * Point de composition (spec T-001 §3) : crée le niveau 1, démarre le rendu (papier et niveau au
 * crayon), construit l'interface DOM (src/ui : textes, panneaux, commandes clavier, tactiles et
 * souris, accessibilité) et lui transmet à chaque image la géométrie de l'écran et les ancres du
 * rendu sous forme de données simples ; affiche la page de repli traduite si aucun GPU n'est
 * utilisable. N'importe pas three : tout le rendu vit dans src/render.
 *
 * Crochet de test : seulement avec `?e2e=1` dans l'URL, `window.__huygens` expose les commandes
 * du niveau, une copie de l'instantané, une avance déterministe du temps et les compteurs de
 * rendu. Dans ce mode, le temps réel ne fait plus avancer le niveau (ni le « boiling ») : seul
 * `advance` le fait, par images fixes de {@link E2E_FRAME_SECONDS}, puis met l'interface à jour.
 */
import {
  ARRIVAL_LEDGE_HEIGHT,
  START_LEDGE_HEIGHT,
  VOID_MAX_X,
  VOID_MIN_X,
  createLevel1,
  type CommandResult,
  type Level1,
  type LevelSnapshot,
} from './game';
import { createTranslator, detectLocale, type Translator } from './i18n';
import {
  PLAY_ZONE,
  computeFrame,
  parseRendererChoice,
  startRendering,
  worldXToPixel,
  worldYToPixel,
  type Frame,
  type LevelAnchors,
  type RenderSession,
  type RenderStats,
} from './render';
import { bindKeyboard, createUi, type ScreenRect, type Ui, type UiGeometry } from './ui';

/** Durée d'une image du crochet de test (s). */
const E2E_FRAME_SECONDS = 1 / 60;

/** Commandes du niveau exposées au crochet de test. */
export interface HuygensCommands {
  moveLeft(): CommandResult;
  moveRight(): CommandResult;
  stop(): CommandResult;
  interact(): CommandResult;
  setKp(value: number): CommandResult;
  adjustKp(delta: number): CommandResult;
  launch(): CommandResult;
  restart(): CommandResult;
  pause(): CommandResult;
  resume(): CommandResult;
}

/** Crochet de test (`?e2e=1` seulement). */
export interface HuygensTestHook {
  /** Commandes du niveau. */
  readonly commands: HuygensCommands;
  /** Copie simple (JSON) de l'instantané courant. */
  snapshot(): LevelSnapshot;
  /**
   * Avance le niveau de `seconds` (arrondi à l'image) par images fixes de 1/60 s, sans attendre
   * le temps réel, puis dessine une image.
   */
  advance(seconds: number): void;
  /** Compteurs de la dernière image dessinée. */
  stats(): RenderStats;
  /** Points de la courbe y(t) de la dernière image (x0, y0, x1, y1… en m). */
  trace(): number[];
}

declare global {
  interface Window {
    /** Crochet de test, défini seulement avec `?e2e=1`. */
    __huygens?: HuygensTestHook;
  }
}

/** Page de documentation du projet, citée par la page de repli. */
const DOCS_URL = 'https://github.com/lucashg7892/pid-game#readme';

/** Remplace le contenu de la page par la page de repli traduite (DOM statique, sans GPU). */
function showFallback(translator: Translator, canvas: HTMLCanvasElement | null): void {
  document.body.dataset['backend'] = 'none';
  if (canvas !== null) {
    canvas.hidden = true;
  }
  const page = document.createElement('main');
  page.id = 'fallback';
  const title = document.createElement('h1');
  title.textContent = translator.t('fallback.title');
  const explanation = document.createElement('p');
  explanation.textContent = translator.t('fallback.explanation');
  const tipsTitle = document.createElement('h2');
  tipsTitle.textContent = translator.t('fallback.tipsTitle');
  const tips = document.createElement('ul');
  for (const key of [
    'fallback.tip.update',
    'fallback.tip.acceleration',
    'fallback.tip.device',
  ] as const) {
    const item = document.createElement('li');
    item.textContent = translator.t(key);
    tips.append(item);
  }
  const docs = document.createElement('p');
  const link = document.createElement('a');
  link.href = DOCS_URL;
  link.textContent = translator.t('fallback.docs');
  docs.append(link);
  page.append(title, explanation, tipsTitle, tips, docs);
  document.body.append(page);
}

/** Vrai si l'URL demande le crochet de test (`e2e=1`). */
function isE2e(search: string): boolean {
  return new URLSearchParams(search).get('e2e') === '1';
}

/** Rectangle écran d'un rectangle monde (pixels CSS). */
function screenRect(
  frame: Frame,
  width: number,
  height: number,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
): ScreenRect {
  return {
    left: worldXToPixel(frame, width, rect.minX),
    right: worldXToPixel(frame, width, rect.maxX),
    top: worldYToPixel(frame, height, rect.maxY),
    bottom: worldYToPixel(frame, height, rect.minY),
  };
}

/**
 * Géométrie de l'écran pour l'interface (T-010), d'après le cadrage du rendu : zone de jeu, cage
 * (colonne x ∈ [0 ; 4] m sur toute la hauteur de la zone de jeu), échelle, quai d'arrivée, et les
 * ancres de la session (objets réutilisés, réécrits à chaque image : passés tels quels).
 */
function uiGeometry(width: number, height: number, anchors: Readonly<LevelAnchors>): UiGeometry {
  const frame = computeFrame(width, height);
  return {
    width,
    height,
    scene: screenRect(frame, width, height, PLAY_ZONE),
    cage: screenRect(frame, width, height, {
      minX: VOID_MIN_X,
      maxX: VOID_MAX_X,
      minY: PLAY_ZONE.minY,
      maxY: PLAY_ZONE.maxY,
    }),
    pixelsPerMeter: frame.pixelsPerMeter,
    console: anchors.console,
    walkerHead: anchors.walkerHead,
    forceGauge: anchors.forceGauge,
    errorDimension: anchors.errorDimension,
    arrivalLedgeY: worldYToPixel(frame, height, ARRIVAL_LEDGE_HEIGHT),
    groundY: worldYToPixel(frame, height, START_LEDGE_HEIGHT),
  };
}

/** Installe `window.__huygens` (mode `?e2e=1`). */
function installTestHook(level: Level1, session: RenderSession, refreshUi: () => void): void {
  window.__huygens = {
    commands: {
      moveLeft: () => level.moveLeft(),
      moveRight: () => level.moveRight(),
      stop: () => level.stop(),
      interact: () => level.interact(),
      setKp: (value: number) => level.setKp(value),
      adjustKp: (delta: number) => level.adjustKp(delta),
      launch: () => level.launch(),
      restart: () => level.restart(),
      pause: () => level.pause(),
      resume: () => level.resume(),
    },
    snapshot: () => JSON.parse(JSON.stringify(level.snapshot)) as LevelSnapshot,
    advance(seconds: number): void {
      const frames =
        Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / E2E_FRAME_SECONDS) : 0;
      for (let i = 0; i < frames; i += 1) {
        level.update(E2E_FRAME_SECONDS);
      }
      session.renderNow(frames * E2E_FRAME_SECONDS);
      refreshUi();
    },
    stats: () => session.stats(),
    trace: () => session.trace(),
  };
}

async function main(): Promise<void> {
  const translator = createTranslator(detectLocale(location.search, navigator.languages));
  document.documentElement.lang = translator.locale;
  document.title = translator.t('app.title');
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (canvas === null) {
    showFallback(translator, null);
    return;
  }
  canvas.setAttribute('aria-label', translator.t('a11y.canvas'));
  const level = createLevel1();
  const manualClock = isE2e(location.search);
  // L'interface est créée après le démarrage du rendu ; la session n'existe pas encore.
  let refreshUi: () => void = () => undefined;
  const result = await startRendering(canvas, parseRendererChoice(location.search), {
    level,
    onFrame: (frameSeconds) => {
      // Mise à jour de l'interface avec les ancres de l'image précédente (décalage d'une image,
      // invisible pour des étiquettes), puis avance du niveau.
      refreshUi();
      if (manualClock) {
        return 0;
      }
      level.update(frameSeconds);
      return frameSeconds;
    },
  });
  if (!result.ok) {
    showFallback(translator, canvas);
    return;
  }
  const { session } = result;
  const root = document.createElement('div');
  root.id = 'ui';
  document.body.append(root);
  const ui: Ui = createUi({ root, level, translator, canvas });
  const anchors = session.anchors();
  let geometry: UiGeometry | null = null;
  let geometryWidth = -1;
  let geometryHeight = -1;
  const measure = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width !== geometryWidth || height !== geometryHeight) {
      geometryWidth = width;
      geometryHeight = height;
      geometry = uiGeometry(width, height, anchors);
    }
  };
  measure();
  window.addEventListener('resize', measure);
  refreshUi = () => {
    ui.update(geometry ?? undefined);
  };
  bindKeyboard(level, ui, window);
  if (manualClock) {
    installTestHook(level, session, () => {
      measure();
      refreshUi();
    });
  }
  refreshUi();
  document.body.dataset['backend'] = session.backend;
  const stats = await session.firstFrame;
  document.body.dataset['drawCalls'] = String(stats.drawCalls);
  document.body.dataset['triangles'] = String(stats.triangles);
}

void main();
