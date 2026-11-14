/**
 * Session de rendu : démarre le renderer, la scène du papier et du niveau au crayon, le suivi de
 * taille et la boucle d'images. Seule entrée dont le point de composition a besoin (il n'importe
 * pas three).
 */
import {
  bootRenderer,
  createFrameLoop,
  observeCanvasSize,
  prefersReducedMotion,
  type Backend,
  disposeRenderer,
  type BootFailureReason,
} from './bootstrap';
import { createFailureGuard, type RenderFailure } from './failure';
import type { LevelSnapshot } from '../game';
import type { SignalRecorder } from '../sim';
import { computeAnchors, createAnchors, type LevelAnchors } from './level-display';
import { createLevelView, type LevelView } from './level-view';
import type { RendererChoice } from './options';
import { createPaperStage } from './stage';

/** Compteurs de la dernière image (`renderer.info.render`). */
export interface RenderStats {
  /** Appels de dessin. */
  readonly drawCalls: number;
  /** Triangles dessinés. */
  readonly triangles: number;
}

/** Niveau à dessiner : lu à chaque image, jamais conservé au-delà (contrat T-007). */
export interface LevelSource {
  /** Instantané courant (objet réutilisé par le niveau). */
  readonly snapshot: Readonly<LevelSnapshot>;
  /** Enregistreur des signaux du trajet. */
  readonly signals: SignalRecorder;
}

/** Options de {@link startRendering}. */
export interface StartOptions {
  /** Niveau à dessiner dès le départ ; absent : papier seul (voir `attachLevel`). */
  readonly level?: LevelSource;
  /**
   * Rappel appelé à chaque image, avant le dessin, avec le temps d'image en secondes (c'est là
   * que le point de composition fait avancer le niveau). Renvoie la durée (s) dont avancer
   * l'horloge visuelle du « boiling » ; défaut : le temps d'image.
   */
  readonly onFrame?: (frameSeconds: number) => number;
  /**
   * Appelé une seule fois si le rendu échoue après son démarrage (perte du contexte GPU ou
   * exception dans `onFrame` ou le dessin) ; la session est déjà arrêtée et le renderer libéré.
   */
  readonly onFailure?: (failure: RenderFailure) => void;
}

/** Rendu en cours. */
export interface RenderSession {
  /** Backend effectif. */
  readonly backend: Backend;
  /** Préférence `prefers-reduced-motion` lue au démarrage. */
  readonly reducedMotion: boolean;
  /** Se résout après la première image dessinée, avec ses compteurs. */
  readonly firstFrame: Promise<RenderStats>;
  /** Compteurs de la dernière image (alloue un objet : à ne pas appeler à chaque image). */
  stats(): RenderStats;
  /**
   * Ancres écran (pixels CSS) de la dernière image, pour les textes DOM de l'interface (T-010).
   * Objet réutilisé, réécrit à chaque image : lire, ne pas conserver.
   */
  anchors(): Readonly<LevelAnchors>;
  /**
   * Dessine une image tout de suite, hors de la boucle, après avoir avancé l'horloge visuelle de
   * `visualSeconds` (crochet de test, captures).
   */
  renderNow(visualSeconds: number): void;
  /**
   * Copie des points de la courbe y(t) de la dernière image (x0, y0, x1, y1… en m) ; vide sans
   * niveau. Alloue : réservé aux tests.
   */
  trace(): number[];
  /**
   * Attache un niveau : crée sa vue et la dessine à chaque image (papier seul auparavant). Un
   * niveau déjà attaché est détaché d'abord. Sans effet après `stop`.
   */
  attachLevel(level: LevelSource): void;
  /** Détache le niveau et libère sa vue ; la session revient au papier seul. Sans effet sinon. */
  detachLevel(): void;
  /** Arrête la boucle et le suivi de taille, libère le renderer. */
  stop(): void;
}

/** Résultat de {@link startRendering}. */
export type StartResult =
  | { readonly ok: true; readonly session: RenderSession }
  | { readonly ok: false; readonly reason: BootFailureReason; readonly detail: string };

/**
 * Démarre le rendu sur `canvas` : papier, et niveau au crayon si `options.level` est fourni. Ne
 * lève jamais : un échec du renderer est renvoyé.
 * @param canvas surface de dessin, dimensionnée par CSS.
 * @param choice choix du renderer (voir `parseRendererChoice`).
 * @param options niveau à dessiner et rappel par image.
 */
export async function startRendering(
  canvas: HTMLCanvasElement,
  choice: RendererChoice,
  options: StartOptions = {},
): Promise<StartResult> {
  const boot = await bootRenderer(canvas, choice);
  if (!boot.ok) {
    return boot;
  }
  const { renderer, backend } = boot;
  const { onFrame } = options;
  const reducedMotion = prefersReducedMotion();
  const stage = createPaperStage(renderer);
  const anchors = createAnchors();
  let surfaceWidth = 0;
  let surfaceHeight = 0;
  let visualSeconds = 0;
  let stopped = false;
  let level: LevelSource | null = null;
  let view: LevelView | null = null;
  const detach = (): void => {
    view?.dispose();
    view = null;
    level = null;
  };
  const attach = (source: LevelSource): void => {
    if (stopped) {
      return;
    }
    detach();
    level = source;
    view = createLevelView(stage.scene);
    if (surfaceWidth > 0) {
      view.resize(stage.frame);
    }
  };
  if (options.level !== undefined) {
    attach(options.level);
  }
  const stopObserving = observeCanvasSize(canvas, renderer, (widthPx, heightPx) => {
    surfaceWidth = widthPx;
    surfaceHeight = heightPx;
    stage.resize(widthPx, heightPx);
    view?.resize(stage.frame);
  });

  /** Repeint le niveau, met à jour les ancres et dessine (aucune allocation de notre part). */
  const draw = (visualAdvance: number): void => {
    visualSeconds += visualAdvance;
    if (view !== null && level !== null) {
      view.paint(level.snapshot, level.signals, visualSeconds, reducedMotion);
      computeAnchors(
        stage.frame,
        surfaceWidth,
        surfaceHeight,
        view.painter.display,
        level.snapshot,
        anchors,
      );
    }
    stage.render();
  };
  const info = renderer.info.render;
  const stats = (): RenderStats => ({ drawCalls: info.drawCalls, triangles: info.triangles });

  let firstFrameDone = false;
  let resolveFirstFrame: (value: RenderStats) => void = () => undefined;
  const firstFrame = new Promise<RenderStats>((resolve) => {
    resolveFirstFrame = resolve;
  });

  let stopSession: () => void = () => undefined;
  const failureGuard = createFailureGuard((failure) => {
    stopSession();
    options.onFailure?.(failure);
  });
  // Perte de contexte WebGL (`webglcontextlost`) ou de périphérique WebGPU (`device.lost`) : three
  // les relaie tous deux ici ; sans ce rappel il ne ferait que journaliser et laisser un canvas figé.
  renderer.onDeviceLost = (info) => {
    failureGuard.fail('context-lost', `${info.api}: ${info.message}`);
  };

  const loop = createFrameLoop(
    renderer,
    failureGuard.guard((frameSeconds) => {
      draw(onFrame === undefined ? frameSeconds : onFrame(frameSeconds));
      if (!firstFrameDone) {
        firstFrameDone = true;
        resolveFirstFrame(stats());
      }
    }),
  );
  const guardedDraw = failureGuard.guard(draw);
  stopSession = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    loop.stop();
    stopObserving();
    detach();
    stage.dispose();
    disposeRenderer(renderer);
  };
  loop.start();

  return {
    ok: true,
    session: {
      backend,
      reducedMotion,
      firstFrame,
      stats,
      anchors(): Readonly<LevelAnchors> {
        return anchors;
      },
      renderNow(seconds: number): void {
        guardedDraw(seconds);
      },
      trace(): number[] {
        if (view === null) {
          return [];
        }
        const trace = view.painter.trace;
        return Array.from(trace.points.subarray(0, trace.count * 2));
      },
      attachLevel: attach,
      detachLevel: detach,
      stop(): void {
        stopSession();
      },
    },
  };
}
