/**
 * Démarrage du renderer (spec T-001 §2, §8) : `WebGPURenderer` de `three/webgpu`, WebGPU puis repli
 * WebGL2, ou WebGL2 imposé, ou absence de GPU simulée. Aucune exception ne sort de
 * {@link bootRenderer} : l'échec est une valeur.
 *
 * Aussi : boucle d'images ({@link createFrameLoop}), suivi de la taille de la surface de dessin
 * ({@link observeCanvasSize}) et préférence de mouvement réduit ({@link watchReducedMotion}).
 */
import { WebGPURenderer } from 'three/webgpu';
import { capPixelRatio, type RendererChoice } from './options';

/** Backend graphique effectivement utilisé. */
export type Backend = 'webgpu' | 'webgl';

/**
 * Raison d'un échec de démarrage :
 * - `disabled` : `?renderer=none` (absence de GPU simulée) ;
 * - `unsupported` : ni WebGPU ni WebGL2 dans ce navigateur ;
 * - `init-failed` : `renderer.init()` a échoué.
 */
export type BootFailureReason = 'disabled' | 'unsupported' | 'init-failed';

/** Résultat de {@link bootRenderer}. */
export type BootResult =
  | { readonly ok: true; readonly backend: Backend; readonly renderer: WebGPURenderer }
  | { readonly ok: false; readonly reason: BootFailureReason; readonly detail: string };

/**
 * Vrai si le navigateur annonce l'API nécessaire au choix demandé : WebGL2 pour `webgl`, WebGPU
 * ou WebGL2 pour `auto`. L'annonce ne garantit pas le succès de `init()`.
 * @param choice choix du renderer.
 */
export function hasGraphicsApi(choice: RendererChoice): boolean {
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined';
  if (choice === 'webgl') {
    return webgl2;
  }
  if (choice === 'none') {
    return false;
  }
  return webgl2 || 'gpu' in navigator;
}

/**
 * Backend effectif d'un renderer initialisé. Les types de `Backend` n'exposent pas le drapeau :
 * on teste sa présence (`WebGLBackend.isWebGLBackend`).
 * @param renderer renderer après `init()`.
 */
export function detectBackend(renderer: WebGPURenderer): Backend {
  const backend = renderer.backend;
  return 'isWebGLBackend' in backend && backend.isWebGLBackend === true ? 'webgl' : 'webgpu';
}

/**
 * Crée et initialise le renderer sur `canvas`. Ne lève jamais : toute erreur devient un échec.
 * @param canvas surface de dessin.
 * @param choice `auto` (WebGPU puis repli WebGL2), `webgl` (`forceWebGL`) ou `none` (échec simulé).
 */
export async function bootRenderer(
  canvas: HTMLCanvasElement,
  choice: RendererChoice,
): Promise<BootResult> {
  if (choice === 'none') {
    return { ok: false, reason: 'disabled', detail: '?renderer=none' };
  }
  if (!hasGraphicsApi(choice)) {
    return { ok: false, reason: 'unsupported', detail: 'ni WebGPU ni WebGL2' };
  }
  let renderer: WebGPURenderer | undefined;
  try {
    renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: choice === 'webgl' });
    await renderer.init();
    return { ok: true, backend: detectBackend(renderer), renderer };
  } catch (error: unknown) {
    if (renderer !== undefined) {
      disposeRenderer(renderer);
    }
    return {
      ok: false,
      reason: 'init-failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Libère un renderer sans jamais lever ni laisser de promesse rejetée non gérée
 * (`Renderer.dispose()` est asynchrone dans three 0.187).
 * @param renderer renderer à libérer, initialisé ou non.
 */
export function disposeRenderer(renderer: WebGPURenderer): void {
  try {
    renderer.dispose().catch(() => undefined);
  } catch {
    // Renderer à moitié construit : rien de plus à libérer.
  }
}

/** Requête média de la préférence « mouvement réduit ». */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Partie de `MediaQueryList` utilisée par {@link createReducedMotionWatcher}. */
export interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: (event: { readonly matches: boolean }) => void): void;
  removeEventListener(
    type: 'change',
    listener: (event: { readonly matches: boolean }) => void,
  ): void;
}

/** Suivi de la préférence « mouvement réduit » : valeur courante lue sans coût. */
export interface ReducedMotionWatcher {
  /** Valeur courante, tenue à jour par l'écouteur `change`. */
  readonly reduced: boolean;
  /** Retire l'écouteur ; la dernière valeur reste lisible. Sans effet si déjà appelé. */
  dispose(): void;
}

/**
 * Suit une requête média `prefers-reduced-motion` : la valeur est lue une fois, puis mise à jour
 * par l'événement `change` (aucune relecture par image).
 * @param query requête média ; `null` si `matchMedia` est indisponible (valeur fixe `false`).
 */
export function createReducedMotionWatcher(query: MediaQueryLike | null): ReducedMotionWatcher {
  let reduced = query?.matches ?? false;
  const onChange = (event: { readonly matches: boolean }): void => {
    reduced = event.matches;
  };
  query?.addEventListener('change', onChange);
  let disposed = false;
  return {
    get reduced(): boolean {
      return reduced;
    },
    dispose(): void {
      if (!disposed) {
        disposed = true;
        query?.removeEventListener('change', onChange);
      }
    },
  };
}

/** Suit la préférence `prefers-reduced-motion: reduce` du système (voir le suivi ci-dessus). */
export function watchReducedMotion(): ReducedMotionWatcher {
  return createReducedMotionWatcher(
    typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : null,
  );
}

/** Boucle d'images pilotée par `renderer.setAnimationLoop`. */
export interface FrameLoop {
  /** Démarre la boucle (sans effet si elle tourne déjà). */
  start(): void;
  /** Arrête la boucle (sans effet si elle est arrêtée) ; le prochain départ repart d'un temps nul. */
  stop(): void;
  /** Vrai entre `start()` et `stop()`. */
  readonly running: boolean;
}

/**
 * Crée une boucle d'images. À chaque image, `onFrame` reçoit le temps écoulé depuis l'image
 * précédente en secondes (0 à la première image, jamais négatif ; non plafonné : l'horloge de
 * simulation plafonne elle-même). Aucune allocation par image : le rappel interne est créé une
 * seule fois et ne manipule que des nombres.
 * @param renderer renderer initialisé.
 * @param onFrame rappel par image.
 */
export function createFrameLoop(
  renderer: WebGPURenderer,
  onFrame: (frameSeconds: number) => void,
): FrameLoop {
  let running = false;
  let lastMs = -1;
  const tick = (timeMs: number): void => {
    const frameSeconds = lastMs < 0 ? 0 : Math.max(0, (timeMs - lastMs) / 1000);
    lastMs = timeMs;
    onFrame(frameSeconds);
  };
  return {
    start(): void {
      if (running) {
        return;
      }
      running = true;
      lastMs = -1;
      void renderer.setAnimationLoop(tick);
    },
    stop(): void {
      if (!running) {
        return;
      }
      running = false;
      void renderer.setAnimationLoop(null);
    },
    get running(): boolean {
      return running;
    },
  };
}

/**
 * Suit la taille CSS du canvas (ResizeObserver) et le rapport de pixels, et les applique au
 * renderer (`setPixelRatio` plafonné, `setSize` sans toucher au style). `onResize` est appelé
 * avec la taille en pixels CSS, une première fois tout de suite.
 * @param canvas canvas du renderer, dimensionné par CSS.
 * @param renderer renderer initialisé.
 * @param onResize rappel après chaque changement de taille.
 * @returns fonction qui arrête le suivi.
 */
export function observeCanvasSize(
  canvas: HTMLCanvasElement,
  renderer: WebGPURenderer,
  onResize: (widthPx: number, heightPx: number) => void,
): () => void {
  const apply = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setPixelRatio(capPixelRatio(window.devicePixelRatio));
    renderer.setSize(width, height, false);
    onResize(width, height);
  };
  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(canvas);
  // Le zoom du navigateur change le rapport de pixels sans toujours changer la taille CSS.
  window.addEventListener('resize', apply);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', apply);
  };
}
