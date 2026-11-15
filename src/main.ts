/**
 * Point de composition (spec T-001 §3, T-017 §3.3) : démarre le rendu une seule fois (papier seul),
 * puis, d'après la machine d'application (src/app), monte l'écran courant et démonte le précédent :
 * titre et menu (src/ui), ou un niveau neuf, 1 ou 2 (aussi depuis l'issue de réussite du précédent) (rendu au crayon, interface DOM, clavier, géométrie
 * de l'écran et ancres du rendu transmises sous forme de données simples). Affiche la page de
 * repli traduite si aucun GPU n'est utilisable, sans passer par le titre. N'importe pas three :
 * tout le rendu vit dans src/render.
 *
 * Crochet de test : seulement avec `?e2e=1` dans l'URL, `window.__huygens` expose la machine
 * d'application, les commandes du niveau courant, une copie de l'instantané, une avance
 * déterministe du temps et les compteurs de rendu. Dans ce mode, le temps réel ne fait plus
 * avancer le niveau (ni le « boiling ») : seul `advance` le fait, par images fixes de
 * {@link E2E_FRAME_SECONDS}, puis met l'interface à jour. `&screen=title|menu|level1|level2` (défaut
 * `level1`) choisit l'écran de départ ; ignoré sans `e2e=1`. Dans ce mode, les animations du
 * niveau (marche vers le poste, embarquement, sortie, D31-D32) sont désactivées par défaut, pour
 * que les e2e écrits avant elles restent valables ; `&anim=1` les active.
 */
import {
  ARRIVAL_LEDGE_HEIGHT,
  START_LEDGE_HEIGHT,
  VOID_MAX_X,
  VOID_MIN_X,
  createLevel1,
  createLevel2,
  type CommandResult,
  type Level,
  type LevelSnapshot,
} from './game';
import {
  LEVELS,
  createAppMachine,
  nextLevelId,
  type AppMachine,
  type AppResult,
  type AppState,
  type ScreenId,
} from './app';
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
  type RenderFailure,
  type RenderFailureKind,
  type RenderSession,
  type RenderStats,
} from './render';
import {
  bindKeyboard,
  createMenuScreen,
  createTitleScreen,
  createUi,
  type ScreenRect,
  type Ui,
  type UiGeometry,
} from './ui';

/** Durée d'une image du crochet de test (s). */
const E2E_FRAME_SECONDS = 1 / 60;

/** Commandes du niveau exposées au crochet de test. */
export interface HuygensCommands {
  moveLeft(): CommandResult;
  moveRight(): CommandResult;
  stop(): CommandResult;
  interact(): CommandResult;
  /** Règle Kp (niveau 1) ; `'ignored'` au niveau 2, où Kp est fixé. */
  setKp(value: number): CommandResult;
  adjustKp(delta: number): CommandResult;
  /** Règle Ki (niveau 2) ; `'ignored'` au niveau 1. */
  setKi(value: number): CommandResult;
  adjustKi(delta: number): CommandResult;
  launch(): CommandResult;
  restart(): CommandResult;
  pause(): CommandResult;
  resume(): CommandResult;
  /** Passe l'animation en cours (marche vers le poste, embarquement, sortie). */
  skipAnimation(): CommandResult;
  /** Active ou désactive les animations du niveau courant (`'accepted'`, `'ignored'` hors niveau). */
  setAnimations(enabled: boolean): CommandResult;
}

/** Machine d'application exposée au crochet de test. */
export interface HuygensApp {
  /** Copie de l'état courant. */
  state(): AppState;
  play(): AppResult;
  openLevel(id: string): AppResult;
  back(): AppResult;
  leaveLevel(): AppResult;
  nextLevel(): AppResult;
}

/** Crochet de test (`?e2e=1` seulement). */
export interface HuygensTestHook {
  /** Machine d'application (écran courant et transitions). */
  readonly app: HuygensApp;
  /** Commandes du niveau courant (`'ignored'` hors niveau). */
  readonly commands: HuygensCommands;
  /** Copie simple (JSON) de l'instantané courant ; lève une erreur hors niveau. */
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
  /** Préférence « mouvement réduit » courante de la session de rendu. */
  reducedMotion(): boolean;
  /** Détache le niveau de la session de rendu (papier seul) ; essai du cycle de vie de la vue. */
  detachLevel(): void;
  /** Rattache le niveau à la session de rendu. */
  attachLevel(): void;
  /** Provoque une exception à la prochaine image (essai de la page de repli d'erreur). */
  crashNextFrame(): void;
}

declare global {
  interface Window {
    /** Crochet de test, défini seulement avec `?e2e=1`. */
    __huygens?: HuygensTestHook;
  }
}

/** Page de documentation du projet, citée par la page de repli. */
const DOCS_URL = 'https://github.com/lucashg7892/pid-game#readme';

/** Cause de la page de repli : pas de GPU au départ, ou échec du rendu en cours de route. */
type FallbackKind = 'unsupported' | RenderFailureKind;

/**
 * Page de repli pour un échec en cours de route (perte du contexte GPU, exception) : un titre,
 * l'explication et l'invitation à recharger, et le lien vers la documentation.
 */
function showFailurePage(translator: Translator, kind: RenderFailureKind): void {
  const page = document.createElement('main');
  page.id = 'fallback';
  page.dataset['kind'] = kind;
  const title = document.createElement('h1');
  const explanation = document.createElement('p');
  if (kind === 'context-lost') {
    title.textContent = translator.t('fallback.lost.title');
    explanation.textContent = translator.t('fallback.lost.explanation');
  } else {
    title.textContent = translator.t('fallback.error.title');
    explanation.textContent = translator.t('fallback.error.explanation');
  }
  const docs = document.createElement('p');
  const link = document.createElement('a');
  link.href = DOCS_URL;
  link.textContent = translator.t('fallback.docs');
  docs.append(link);
  page.append(title, explanation, docs);
  document.body.append(page);
}

/** Remplace le contenu de la page par la page de repli traduite (DOM statique, sans GPU). */
function showFallback(
  translator: Translator,
  canvas: HTMLCanvasElement | null,
  kind: FallbackKind = 'unsupported',
): void {
  document.body.dataset['backend'] = 'none';
  if (canvas !== null) {
    canvas.hidden = true;
  }
  if (kind !== 'unsupported') {
    showFailurePage(translator, kind);
    return;
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

/** Animations du niveau en mode test : désactivées sauf `anim=1`. */
function e2eAnimations(search: string): boolean {
  return new URLSearchParams(search).get('anim') === '1';
}

/** Écran de départ du mode test (`screen=title|menu|level1|level2`, défaut `level1`). */
function e2eStartScreen(search: string): 'title' | 'menu' | 'level1' | 'level2' {
  const value = new URLSearchParams(search).get('screen');
  return value === 'title' || value === 'menu' || value === 'level2' ? value : 'level1';
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
    gaugeMax: anchors.gaugeMax,
    gaugeWeight: anchors.gaugeWeight,
    iGauge: anchors.iGauge,
    get iGaugeVisible(): boolean {
      return anchors.iGaugeVisible;
    },
    errorDimension: anchors.errorDimension,
    arrivalLedgeY: worldYToPixel(frame, height, ARRIVAL_LEDGE_HEIGHT),
    groundY: worldYToPixel(frame, height, START_LEDGE_HEIGHT),
  };
}

/** Niveau courant et ses points d'accès, partagés avec la boucle de rendu et le crochet de test. */
interface CurrentLevel {
  readonly level: Level;
  /** Met l'interface du niveau à jour (géométrie comprise). */
  readonly refreshUi: () => void;
  /** Recalcule la géométrie si la taille du canvas a changé. */
  readonly measure: () => void;
}

/** Installe `window.__huygens` (mode `?e2e=1`). */
function installTestHook(
  machine: AppMachine,
  session: RenderSession,
  current: () => CurrentLevel | null,
  crashNextFrame: () => void,
): void {
  const command = (run: (level: Level) => CommandResult): CommandResult => {
    const c = current();
    return c === null ? 'ignored' : run(c.level);
  };
  /** Commande de réglage, acceptée seulement si le niveau courant règle cette grandeur. */
  const tuned = (param: 'kp' | 'ki', run: (level: Level) => CommandResult): CommandResult =>
    command((l) => (l.tuning.param === param ? run(l) : 'ignored'));
  window.__huygens = {
    app: {
      state: () => ({ ...machine.state }),
      play: () => machine.play(),
      openLevel: (id: string) => machine.openLevel(id),
      back: () => machine.back(),
      leaveLevel: () => machine.leaveLevel(),
      nextLevel: () => machine.nextLevel(),
    },
    commands: {
      moveLeft: () => command((l) => l.moveLeft()),
      moveRight: () => command((l) => l.moveRight()),
      stop: () => command((l) => l.stop()),
      interact: () => command((l) => l.interact()),
      setKp: (value: number) => tuned('kp', (l) => l.setTuning(value)),
      adjustKp: (delta: number) => tuned('kp', (l) => l.adjustTuning(delta)),
      setKi: (value: number) => tuned('ki', (l) => l.setTuning(value)),
      adjustKi: (delta: number) => tuned('ki', (l) => l.adjustTuning(delta)),
      launch: () => command((l) => l.launch()),
      restart: () => command((l) => l.restart()),
      pause: () => command((l) => l.pause()),
      resume: () => command((l) => l.resume()),
      skipAnimation: () => command((l) => l.skipAnimation()),
      setAnimations: (enabled: boolean) =>
        command((l) => {
          l.setAnimations(enabled);
          return 'accepted';
        }),
    },
    snapshot(): LevelSnapshot {
      const c = current();
      if (c === null) {
        throw new Error('aucun niveau en cours');
      }
      return JSON.parse(JSON.stringify(c.level.snapshot)) as LevelSnapshot;
    },
    advance(seconds: number): void {
      const c = current();
      const frames =
        Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / E2E_FRAME_SECONDS) : 0;
      for (let i = 0; i < frames; i += 1) {
        c?.level.update(E2E_FRAME_SECONDS);
      }
      session.renderNow(frames * E2E_FRAME_SECONDS);
      if (c !== null) {
        c.measure();
        c.refreshUi();
      }
    },
    stats: () => session.stats(),
    trace: () => session.trace(),
    reducedMotion: () => session.reducedMotion,
    detachLevel: () => {
      session.detachLevel();
    },
    attachLevel: () => {
      const c = current();
      if (c !== null) {
        session.attachLevel(c.level);
      }
    },
    crashNextFrame,
  };
}

async function main(): Promise<void> {
  const translator = createTranslator(detectLocale(location.search, navigator.languages));
  const syncDocumentLanguage = (): void => {
    document.documentElement.lang = translator.locale;
    document.title = translator.t('app.title');
  };
  syncDocumentLanguage();
  translator.subscribe(syncDocumentLanguage);
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (canvas === null) {
    showFallback(translator, null);
    return;
  }
  canvas.setAttribute('aria-label', translator.t('a11y.canvas'));
  const e2e = isE2e(location.search);
  // Animations du niveau : toujours en jeu normal (le branchement sur `prefers-reduced-motion`
  // viendra avec le dessin des poses) ; en mode test, seulement avec `anim=1`.
  const animations = !e2e || e2eAnimations(location.search);
  let current: CurrentLevel | null = null;
  let crashNextFrame = false;
  // Démontage de l'écran courant ; appelé à chaque changement d'écran et en cas d'échec, avant la
  // page de repli (pas de boutons morts devant elle).
  let unmount: () => void = () => undefined;
  const unmountCurrent = (): void => {
    const run = unmount;
    unmount = () => undefined;
    current = null;
    try {
      run();
    } catch {
      // Le nettoyage ne doit jamais empêcher l'écran suivant ni la page de repli.
    }
  };
  let failed = false;
  const handleFailure = (failure: RenderFailure): void => {
    if (failed) {
      return;
    }
    failed = true;
    console.error(`Huygens’s world : ${failure.kind} : ${failure.detail}`);
    unmountCurrent();
    showFallback(translator, canvas, failure.kind);
  };
  const result = await startRendering(canvas, parseRendererChoice(location.search), {
    onFrame: (frameSeconds) => {
      if (crashNextFrame) {
        throw new Error('panne simulée (?e2e=1)');
      }
      const c = current;
      if (c === null) {
        return 0;
      }
      if (e2e) {
        return 0;
      }
      c.level.update(frameSeconds);
      return frameSeconds;
    },
    // Interface mise à jour après le dessin, d'après les ancres de l'image affichée (K10).
    onFrameEnd: () => {
      current?.refreshUi();
    },
    onFailure: handleFailure,
  });
  if (!result.ok) {
    showFallback(translator, canvas);
    return;
  }
  const { session } = result;

  /** Conteneur d'un écran, ajouté au document. */
  const container = (id: string): HTMLDivElement => {
    const root = document.createElement('div');
    root.id = id;
    document.body.append(root);
    return root;
  };

  const machine = createAppMachine(LEVELS);
  let lastLevelId: string | undefined;

  const mountTitle = (): (() => void) => {
    canvas.setAttribute('aria-hidden', 'true');
    const root = container('screens');
    const screen = createTitleScreen({
      root,
      translator,
      onPlay: () => {
        machine.play();
      },
    });
    return () => {
      screen.destroy();
      root.remove();
    };
  };

  const mountMenu = (previous: ScreenId | null): (() => void) => {
    canvas.setAttribute('aria-hidden', 'true');
    const root = container('screens');
    const screen = createMenuScreen({
      root,
      translator,
      levels: LEVELS,
      onOpen: (id) => {
        machine.openLevel(id);
      },
      onBack: () => {
        machine.back();
      },
      ...(lastLevelId === undefined || previous !== 'level' ? {} : { focusLevelId: lastLevelId }),
    });
    return () => {
      screen.destroy();
      root.remove();
    };
  };

  /** Monte le niveau `levelId` neuf : rendu, interface, clavier, géométrie. */
  const mountLevel = (levelId: string): (() => void) => {
    const cleanups: Array<() => void> = [];
    const unmountLevel = (): void => {
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
          // Chaque retrait est indépendant des autres.
        }
      }
    };
    try {
      const level =
        levelId === 'level2' ? createLevel2({ animations }) : createLevel1({ animations });
      session.attachLevel(level);
      cleanups.push(() => {
        session.detachLevel();
      });
      const root = container('ui');
      cleanups.push(() => {
        root.remove();
      });
      const ui: Ui = createUi({
        root,
        level,
        translator,
        canvas,
        onMenu: () => {
          machine.leaveLevel();
        },
        // Seulement s'il existe un niveau suivant : sinon le bouton « Niveau suivant » n'existe pas.
        ...(nextLevelId(levelId) === null
          ? {}
          : {
              onNext: () => {
                machine.nextLevel();
              },
            }),
      });
      cleanups.push(() => {
        ui.destroy();
      });
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
      cleanups.push(() => {
        window.removeEventListener('resize', measure);
      });
      // K18 : la taille du canvas peut changer sans `resize` de la fenêtre.
      const observer = new ResizeObserver(measure);
      observer.observe(canvas);
      cleanups.push(() => {
        observer.disconnect();
      });
      const refreshUi = (): void => {
        ui.update(geometry ?? undefined);
      };
      cleanups.push(bindKeyboard(level, ui, window));
      current = { level, refreshUi, measure };
      refreshUi();
    } catch (error: unknown) {
      unmountLevel();
      throw error;
    }
    return unmountLevel;
  };

  /** Monte l'écran de l'état donné. */
  const show = (state: Readonly<AppState>, previous: ScreenId | null = null): void => {
    switch (state.screen) {
      case 'title':
        unmount = mountTitle();
        return;
      case 'menu':
        unmount = mountMenu(previous);
        return;
      case 'level':
        lastLevelId = state.levelId ?? undefined;
        unmount = mountLevel(state.levelId ?? 'level1');
        return;
    }
  };

  try {
    if (e2e) {
      const start = e2eStartScreen(location.search);
      if (start !== 'title') {
        machine.play();
      }
      if (start === 'level1' || start === 'level2') {
        machine.openLevel(start);
      }
      installTestHook(
        machine,
        session,
        () => current,
        () => {
          crashNextFrame = true;
        },
      );
    }
    show(machine.state);
    machine.subscribe((state, previous) => {
      if (failed) {
        return;
      }
      try {
        unmountCurrent();
        show(state, previous);
      } catch (error: unknown) {
        session.stop();
        handleFailure({
          kind: 'error',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    });
    document.body.dataset['backend'] = session.backend;
    const stats = await session.firstFrame;
    document.body.dataset['drawCalls'] = String(stats.drawCalls);
    document.body.dataset['triangles'] = String(stats.triangles);
  } catch (error: unknown) {
    // Exception après le démarrage du renderer, hors boucle d'images (création de l'interface...).
    session.stop();
    handleFailure({
      kind: 'error',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

void main();
