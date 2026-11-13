/**
 * Point de composition (spec T-001 §3) : crée le niveau 1, démarre le rendu (papier et niveau au
 * crayon) et branche des commandes clavier PROVISOIRES (remplacées par l'interface en T-010) ;
 * affiche la page de repli traduite si aucun GPU n'est utilisable. N'importe pas three : tout le
 * rendu vit dans src/render.
 *
 * Crochet de test : seulement avec `?e2e=1` dans l'URL, `window.__huygens` expose les commandes
 * du niveau, une copie de l'instantané, une avance déterministe du temps et les compteurs de
 * rendu. Dans ce mode, le temps réel ne fait plus avancer le niveau (ni le « boiling ») : seul
 * `advance` le fait, par images fixes de {@link E2E_FRAME_SECONDS}.
 */
import { KP_STEP, createLevel1, type CommandResult, type Level1, type LevelSnapshot } from './game';
import { createTranslator, detectLocale, type Translator } from './i18n';
import {
  parseRendererChoice,
  startRendering,
  type RenderSession,
  type RenderStats,
} from './render';

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

/**
 * Commandes clavier provisoires (spec §6 ; remplacées en T-010) : ←/→ ou A/D (`code`, donc Q/D
 * en AZERTY) marcher, relâcher = s'arrêter ; E, Entrée ou Espace : interagir à la console, puis
 * lancer quand le réglage est ouvert ; + / − : Kp ± 100 ; R : recommencer ; Échap : pause.
 */
function bindKeyboard(level: Level1): void {
  let left = false;
  let right = false;
  const walk = (): void => {
    if (left && !right) {
      level.moveLeft();
    } else if (right && !left) {
      level.moveRight();
    } else {
      level.stop();
    }
  };
  window.addEventListener('keydown', (event) => {
    let handled = true;
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        left = true;
        walk();
        break;
      case 'ArrowRight':
      case 'KeyD':
        right = true;
        walk();
        break;
      case 'KeyE':
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (!event.repeat) {
          if (level.snapshot.phase === 'tuning') {
            level.launch();
          } else {
            level.interact();
          }
        }
        break;
      case 'NumpadAdd':
        level.adjustKp(KP_STEP);
        break;
      case 'NumpadSubtract':
        level.adjustKp(-KP_STEP);
        break;
      case 'KeyR':
        level.restart();
        break;
      case 'Escape':
        if (level.snapshot.phase === 'paused') {
          level.resume();
        } else {
          level.pause();
        }
        break;
      default:
        if (event.key === '+' || event.key === '=') {
          level.adjustKp(KP_STEP);
        } else if (event.key === '-') {
          level.adjustKp(-KP_STEP);
        } else {
          handled = false;
        }
    }
    if (handled) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      left = false;
      walk();
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      right = false;
      walk();
    }
  });
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    walk();
  });
}

/** Installe `window.__huygens` (mode `?e2e=1`). */
function installTestHook(level: Level1, session: RenderSession): void {
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
    },
    stats: () => session.stats(),
    trace: () => session.trace(),
  };
}

async function main(): Promise<void> {
  const translator = createTranslator(detectLocale(location.search, navigator.languages));
  document.documentElement.lang = translator.locale;
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (canvas === null) {
    showFallback(translator, null);
    return;
  }
  canvas.setAttribute('aria-label', translator.t('a11y.canvas'));
  const level = createLevel1();
  const manualClock = isE2e(location.search);
  const result = await startRendering(canvas, parseRendererChoice(location.search), {
    level,
    onFrame: (frameSeconds) => {
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
  bindKeyboard(level);
  if (manualClock) {
    installTestHook(level, session);
  }
  document.body.dataset['backend'] = session.backend;
  const stats = await session.firstFrame;
  document.body.dataset['drawCalls'] = String(stats.drawCalls);
  document.body.dataset['triangles'] = String(stats.triangles);
}

void main();
