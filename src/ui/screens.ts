/**
 * DOM des écrans titre et menu des niveaux (spec T-017 §4). Chaque écran est un `<main>` nommé
 * par son titre, monté dans un conteneur fourni et déjà attaché au document ; `destroy()` retire
 * le DOM, les écouteurs et l'abonnement au traducteur (idempotent). Le focus est posé au montage
 * et une phrase est annoncée dans une région `aria-live` de l'écran.
 */
import type { LevelEntry } from '../app';
import { otherLocale, type Translator } from '../i18n';
import { screenKeyToIntent } from './screen-keys';
import { buildMenuView, buildTitleView, type MenuView, type TitleView } from './screens-model';
import './ui.css';
import './screens.css';

/** Délai avant d'écrire l'annonce (ms) : une région vide d'abord, pour que le texte soit lu. */
const ANNOUNCE_DELAY_MS = 100;

/** Champs communs de l'événement clavier pour {@link screenKeyToIntent}. */
function keyFields(event: KeyboardEvent): {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
} {
  return {
    code: event.code,
    repeat: event.repeat,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };
}

/** Pas de liste de contrôles (écran titre). */
const NO_FOCUS = { focusIndex: -1, focusCount: 0 } as const;

/** Écran monté. */
export interface Screen {
  /** Retire l'écran du document ; sans effet si déjà appelée. */
  destroy(): void;
}

/** Options de {@link createTitleScreen}. */
export interface TitleScreenOptions {
  /** Conteneur (dans le document). */
  readonly root: HTMLElement;
  /** Traducteur (langue courante, bascule). */
  readonly translator: Translator;
  /** Appelé au clic sur « Jouer ». */
  readonly onPlay: () => void;
}

/** Options de {@link createMenuScreen}. */
export interface MenuScreenOptions {
  /** Conteneur (dans le document). */
  readonly root: HTMLElement;
  /** Traducteur. */
  readonly translator: Translator;
  /** Niveaux à lister, dans l'ordre. */
  readonly levels: readonly LevelEntry[];
  /** Appelé avec l'identifiant du niveau choisi. */
  readonly onOpen: (id: string) => void;
  /** Appelé au clic sur « Retour » ou à Échap. */
  readonly onBack: () => void;
  /** Niveau qui reçoit le focus (retour d'un niveau) ; défaut : le premier jouable. */
  readonly focusLevelId?: string;
}

/** Ensemble des écouteurs et minuteries d'un écran. */
class Disposables {
  private readonly cleanups: (() => void)[] = [];

  on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => {
      target.removeEventListener(type, handler);
    });
  }

  /**
   * Clic de navigation : ignoré s'il est le deuxième d'un double-clic ou d'un double tape
   * (`detail` > 1), car il tomberait sur l'écran qui vient de remplacer celui du premier clic
   * (A-01). Un clic clavier ou synthétique (`element.click()`, lecteur d'écran) a `detail` 0.
   */
  onNavigate(target: HTMLElement, handler: () => void): void {
    this.on(target, 'click', (event) => {
      if (event.detail > 1) {
        return;
      }
      handler();
    });
  }

  onDocumentKey(handler: (event: KeyboardEvent) => void): void {
    document.addEventListener('keydown', handler);
    this.cleanups.push(() => {
      document.removeEventListener('keydown', handler);
    });
  }

  add(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  run(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
  }
}

/** Crée un élément enfant de `parent`. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') {
    node.className = className;
  }
  parent.append(node);
  return node;
}

/** Écran `<main>` avec carte de papier ; renvoie les deux. */
function frame(root: HTMLElement, id: string): { main: HTMLElement; card: HTMLElement } {
  root.classList.add('ui');
  const main = el('main', 'ui-screen', root);
  main.setAttribute('aria-labelledby', id);
  const card = el('div', 'ui-paper ui-screen-card', main);
  return { main, card };
}

/** Région d'annonce : vide au montage, remplie après un court délai. */
function announcer(main: HTMLElement, disposables: Disposables): (text: string) => void {
  const region = el('p', 'ui-sr', main);
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  let timer: ReturnType<typeof setTimeout> | null = null;
  disposables.add(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
  return (text) => {
    timer = setTimeout(() => {
      region.textContent = text;
    }, ANNOUNCE_DELAY_MS);
  };
}

/**
 * Monte l'écran titre : titre, sous-titre, « Jouer » (focus initial), bouton de langue, mention
 * de copyright.
 * @param options conteneur, traducteur, action « Jouer ».
 */
export function createTitleScreen(options: TitleScreenOptions): Screen {
  const { root, translator: tr, onPlay } = options;
  const disposables = new Disposables();
  const { main, card } = frame(root, 'screen-title-h1');

  const heading = el('h1', 'ui-screen-title', card);
  heading.id = 'screen-title-h1';
  const tagline = el('p', 'ui-screen-tagline', card);
  const actions = el('div', 'ui-screen-actions', card);
  const play = el('button', 'ui-btn ui-primary ui-screen-btn', actions);
  play.type = 'button';
  const lang = el('button', 'ui-btn ui-lang ui-screen-btn', actions);
  lang.type = 'button';
  lang.setAttribute('aria-describedby', 'screen-lang-desc');
  const langText = el('span', '', lang);
  const langDesc = el('span', 'ui-sr', actions);
  langDesc.id = 'screen-lang-desc';
  const footer = el('footer', 'ui-screen-legal', main);
  const copyright = el('p', '', footer);
  const license = el('p', '', footer);
  const announce = announcer(main, disposables);

  const render = (view: TitleView): void => {
    heading.textContent = view.title;
    tagline.textContent = view.tagline;
    play.textContent = view.play;
    langText.textContent = view.languageButton;
    langText.lang = view.otherLocale;
    langDesc.textContent = view.languageDescription;
    copyright.textContent = view.copyright;
    license.textContent = view.license;
  };
  const first = buildTitleView(tr);
  render(first);
  announce(first.announce);

  disposables.onNavigate(play, onPlay);
  disposables.onNavigate(lang, () => {
    tr.setLocale(otherLocale(tr.locale));
  });
  disposables.onDocumentKey((event) => {
    const intent = screenKeyToIntent({ ...keyFields(event), screen: 'title', ...NO_FOCUS });
    if (intent === 'block') {
      event.preventDefault();
    }
  });
  disposables.add(
    tr.subscribe(() => {
      render(buildTitleView(tr));
    }),
  );
  play.focus();

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      disposables.run();
      main.remove();
    },
  };
}

/**
 * Monte le menu des niveaux : titre, liste des niveaux, « Retour ». Flèches haut et bas dans la
 * liste, Échap pour revenir (touches pures : `screen-keys.ts`).
 * @param options conteneur, traducteur, niveaux, actions.
 */
export function createMenuScreen(options: MenuScreenOptions): Screen {
  const { root, translator: tr, levels, onOpen, onBack } = options;
  const disposables = new Disposables();
  const { main, card } = frame(root, 'screen-menu-h1');

  const heading = el('h1', 'ui-screen-title', card);
  heading.id = 'screen-menu-h1';
  const list = el('ul', 'ui-screen-list', card);
  list.setAttribute('role', 'list');
  const buttons = levels.map((level) => {
    const item = el('li', '', list);
    const button = el('button', 'ui-btn ui-screen-btn ui-screen-level', item);
    button.type = 'button';
    button.disabled = !level.playable;
    disposables.onNavigate(button, () => {
      onOpen(level.id);
    });
    return button;
  });
  const back = el('button', 'ui-btn ui-screen-btn ui-screen-back', card);
  back.type = 'button';
  disposables.onNavigate(back, onBack);
  const announce = announcer(main, disposables);

  const render = (view: MenuView): void => {
    heading.textContent = view.title;
    list.setAttribute('aria-label', view.listLabel);
    view.entries.forEach((entry, i) => {
      const button = buttons[i];
      if (button !== undefined) {
        button.textContent = entry.label;
      }
    });
    back.textContent = view.back;
  };
  const first = buildMenuView(tr, levels);
  render(first);
  announce(first.announce);
  disposables.add(
    tr.subscribe(() => {
      render(buildMenuView(tr, levels));
    }),
  );

  /** Contrôles focalisables dans l'ordre visuel : niveaux jouables, puis « Retour ». */
  const focusables = (): HTMLButtonElement[] => [...buttons.filter((b) => !b.disabled), back];

  disposables.onDocumentKey((event) => {
    const controls = focusables();
    const intent = screenKeyToIntent({
      ...keyFields(event),
      screen: 'menu',
      focusIndex: controls.findIndex((b) => b === document.activeElement),
      focusCount: controls.length,
    });
    if (intent === 'none') {
      return;
    }
    event.preventDefault();
    const index = controls.findIndex((b) => b === document.activeElement);
    switch (intent) {
      case 'back':
        if (!event.repeat) {
          onBack();
        }
        return;
      case 'focusFirst':
        controls[0]?.focus();
        return;
      case 'focusLast':
        controls[controls.length - 1]?.focus();
        return;
      case 'focusNext':
        controls[index + 1]?.focus();
        return;
      case 'focusPrev':
        controls[index - 1]?.focus();
        return;
      default:
        return;
    }
  });

  const wanted = levels.findIndex((l) => l.id === options.focusLevelId && l.playable);
  const initial = wanted >= 0 ? buttons[wanted] : focusables()[0];
  initial?.focus();

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      disposables.run();
      main.remove();
    },
  };
}
