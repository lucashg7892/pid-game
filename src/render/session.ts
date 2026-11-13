/**
 * Session de rendu : démarre le renderer, la scène du papier, le suivi de taille et la boucle
 * d'images. Seule entrée dont le point de composition a besoin (il n'importe pas three).
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
import type { RendererChoice } from './options';
import { createPaperStage } from './stage';

/** Compteurs de la dernière image (`renderer.info.render`). */
export interface RenderStats {
  /** Appels de dessin. */
  readonly drawCalls: number;
  /** Triangles dessinés. */
  readonly triangles: number;
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
  /** Arrête la boucle et le suivi de taille, libère le renderer. */
  stop(): void;
}

/** Résultat de {@link startRendering}. */
export type StartResult =
  | { readonly ok: true; readonly session: RenderSession }
  | { readonly ok: false; readonly reason: BootFailureReason; readonly detail: string };

/**
 * Démarre le rendu du papier sur `canvas`. Ne lève jamais : un échec du renderer est renvoyé.
 * @param canvas surface de dessin, dimensionnée par CSS.
 * @param choice choix du renderer (voir `parseRendererChoice`).
 * @param onFrame rappel facultatif appelé à chaque image, avant le dessin, avec le temps d'image
 *   en secondes.
 */
export async function startRendering(
  canvas: HTMLCanvasElement,
  choice: RendererChoice,
  onFrame?: (frameSeconds: number) => void,
): Promise<StartResult> {
  const boot = await bootRenderer(canvas, choice);
  if (!boot.ok) {
    return boot;
  }
  const { renderer, backend } = boot;
  const stage = createPaperStage(renderer);
  const stopObserving = observeCanvasSize(canvas, renderer, (widthPx, heightPx) => {
    stage.resize(widthPx, heightPx);
  });
  const info = renderer.info.render;
  const stats = (): RenderStats => ({ drawCalls: info.drawCalls, triangles: info.triangles });

  let firstFrameDone = false;
  let resolveFirstFrame: (value: RenderStats) => void = () => undefined;
  const firstFrame = new Promise<RenderStats>((resolve) => {
    resolveFirstFrame = resolve;
  });

  const loop = createFrameLoop(renderer, (frameSeconds) => {
    onFrame?.(frameSeconds);
    stage.render();
    if (!firstFrameDone) {
      firstFrameDone = true;
      resolveFirstFrame(stats());
    }
  });
  loop.start();

  return {
    ok: true,
    session: {
      backend,
      reducedMotion: prefersReducedMotion(),
      firstFrame,
      stats,
      stop(): void {
        loop.stop();
        stopObserving();
        stage.dispose();
        disposeRenderer(renderer);
      },
    },
  };
}
