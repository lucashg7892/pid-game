/**
 * Interface DOM superposée au canvas (T-010) : barre du haut (titre, Kp et Ki, pupitre, aide, langue,
 * pause), bulle, bandeau d'aide, tableau d'école (zone cliquable sur le chevalet et fenêtre modale,
 * T-042), pupitre de contrôle (réglage de Kp ou de Ki, T-049 : `pupitre/`), mesures du trajet et
 * légende, issue, cote chiffrée, aide des commandes, commandes tactiles, invite d'orientation et
 * région `aria-live`.
 *
 * Le DOM est construit une fois. À chaque image, {@link Ui.update} reconstruit le modèle de vue
 * (pur, `view-model.ts`), consomme les événements du niveau (annonces), calcule la disposition
 * (pure, `layout.ts`) puis n'écrit que les nœuds dont la valeur a changé (comparaison avant
 * écriture) : rien n'est écrit, et presque rien n'est alloué, en régime établi.
 */
import type { GameEvent, Level, LevelPhase } from '../game';
import type { Translator } from '../i18n';
import { admitEvent, announcementFor, createLaunchGate, releaseLaunch } from './announce';
import type { HintLine } from './hints';
import { boardValues, buildBoardSections, renderBoard, type BoardValueNodes } from './board';
import {
  commandsBlocked,
  cycleFocusIndex,
  modalPauseDecision,
  trapFocusIndex,
  type ModalKind,
} from './help';
import {
  BOARD_HIT_MIN,
  computeLayout,
  createLayout,
  dockOutcome,
  isConsoleHit,
  type PanelBox,
  type UiGeometry,
} from './layout';
import { creerColonnesTrajet, creerPupitre, type Pupitre } from './pupitre';
import { createViewModelBuilder, type ViewModel } from './view-model';
import './ui.css';

/** Options de {@link createUi}. */
export interface UiOptions {
  /** Conteneur de l'interface (ajouté au document par l'appelant). */
  readonly root: HTMLElement;
  /** Niveau piloté. */
  readonly level: Level;
  /** Traducteur (langue courante, bascule). */
  readonly translator: Translator;
  /** Canvas de la scène (libellé accessible, clic sur la console). */
  readonly canvas: HTMLCanvasElement;
  /**
   * Retour au menu des niveaux, sans confirmation. Le bouton « Menu » n'existe que si cette
   * action est fournie ; il est visible en pause et dans le panneau d'issue.
   */
  readonly onMenu?: () => void;
  /**
   * Passage direct au niveau suivant. Le bouton « Niveau suivant » n'existe que si cette action
   * est fournie ; il n'est visible qu'à l'issue de réussite.
   */
  readonly onNext?: () => void;
}

/** Interface en cours. */
export interface Ui {
  /** Vrai si l'aide des commandes est ouverte. */
  readonly helpOpen: boolean;
  /** Vrai si le tableau d'école est ouvert. */
  readonly boardOpen: boolean;
  /** Vrai si le pupitre de contrôle est visible. */
  readonly pupitreOpen: boolean;
  /** Vrai si le pupitre est ouvert en lecture seule (hors phase de réglage). */
  readonly pupitreLecture: boolean;
  /**
   * Met l'interface à jour d'après le niveau ; `geometry` absente : garde la dernière.
   * @param geometry géométrie de l'écran (objets lus, jamais modifiés).
   */
  update(geometry?: Readonly<UiGeometry>): void;
  /**
   * Ouvre ou ferme l'aide des commandes.
   * @param open vrai pour ouvrir.
   */
  setHelp(open: boolean): void;
  /**
   * Ouvre ou ferme le tableau d'école. L'ouvrir ferme l'aide (et inversement) sans toucher à la
   * pause ; il met le jeu en pause comme l'aide, et ne reprend que la pause qu'il a posée.
   * @param open vrai pour ouvrir.
   */
  setBoard(open: boolean): void;
  /**
   * Ouvre ou ferme le pupitre de contrôle, sans jamais mettre le jeu en pause. En approche,
   * l'ouvrir ouvre le réglage (le bonhomme rejoint le poste) et le fermer en phase de réglage le
   * referme (comme Échap avant lui) ; en trajet, embarquement, sortie, issue ou pause, il s'ouvre
   * en lecture seule.
   * @param open vrai pour ouvrir.
   */
  setPupitre(open: boolean): void;
  /**
   * Démonte l'interface : retire les écouteurs du document, du canvas et du traducteur, vide le
   * conteneur et masque le canvas aux lecteurs d'écran. Sans effet si déjà appelée.
   */
  destroy(): void;
}

/** Nombre d'annonces gardées dans la région `aria-live`. */
const LIVE_HISTORY = 3;

/** Crée un élément avec une classe. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') {
    node.className = className;
  }
  parent?.append(node);
  return node;
}

/** Nœud de texte mis à jour seulement si la chaîne change (comparaison de référence). */
class TextSlot {
  private last: string | null = null;
  constructor(readonly node: HTMLElement) {}
  /** Écrit `value` si elle diffère de la dernière écrite. */
  set(value: string): void {
    if (value !== this.last) {
      this.last = value;
      this.node.textContent = value;
    }
  }
}

/** Attribut mis à jour seulement s'il change. */
class AttrSlot {
  private last: string | null = null;
  constructor(
    readonly node: Element,
    readonly name: string,
  ) {}
  /** Écrit l'attribut si la valeur change. */
  set(value: string): void {
    if (value !== this.last) {
      this.last = value;
      this.node.setAttribute(this.name, value);
    }
  }
}

/** Visibilité (`hidden`) mise à jour seulement si elle change. */
function show(node: HTMLElement, visible: boolean): void {
  if (node.hidden === visible) {
    node.hidden = !visible;
  }
}

/** État désactivé mis à jour seulement s'il change. */
function enable(node: HTMLButtonElement | HTMLInputElement, enabled: boolean): void {
  if (node.disabled === enabled) {
    node.disabled = !enabled;
  }
}

/** Position d'un panneau, écrite seulement quand la boîte change. */
class BoxSlot {
  private left = Number.NaN;
  private width = Number.NaN;
  private edge = Number.NaN;
  private maxHeight = Number.NaN;
  private anchor = '';
  private viewportHeight = Number.NaN;
  constructor(readonly node: HTMLElement) {}
  /** Applique la boîte (`bottom` calculé depuis la hauteur de l'écran). */
  apply(b: Readonly<PanelBox>, height: number): void {
    const style = this.node.style;
    if (b.left !== this.left) {
      this.left = b.left;
      style.left = `${String(b.left)}px`;
    }
    if (b.width !== this.width) {
      this.width = b.width;
      style.width = `${String(b.width)}px`;
    }
    if (b.maxHeight !== this.maxHeight) {
      this.maxHeight = b.maxHeight;
      style.maxHeight = `${String(b.maxHeight)}px`;
    }
    if (b.anchor !== this.anchor || b.edge !== this.edge || height !== this.viewportHeight) {
      this.anchor = b.anchor;
      this.edge = b.edge;
      this.viewportHeight = height;
      if (b.anchor === 'top') {
        style.top = `${String(b.edge)}px`;
        style.bottom = '';
      } else {
        style.top = '';
        style.bottom = `${String(height - b.edge)}px`;
      }
    }
  }
}

/** Rectangle d'une zone cliquable, écrit seulement s'il change. */
class RectSlot {
  private left = Number.NaN;
  private top = Number.NaN;
  private width = Number.NaN;
  private height = Number.NaN;
  constructor(readonly node: HTMLElement) {}
  /** Place la zone (pixels CSS). */
  apply(left: number, top: number, width: number, height: number): void {
    const style = this.node.style;
    if (left !== this.left) {
      this.left = left;
      style.left = `${String(left)}px`;
    }
    if (top !== this.top) {
      this.top = top;
      style.top = `${String(top)}px`;
    }
    if (width !== this.width) {
      this.width = width;
      style.width = `${String(width)}px`;
    }
    if (height !== this.height) {
      this.height = height;
      style.height = `${String(height)}px`;
    }
  }
}

/** Point d'ancrage d'une étiquette, écrit seulement s'il change. */
class PointSlot {
  private x = Number.NaN;
  private y = Number.NaN;
  constructor(readonly node: HTMLElement) {}
  /** Place l'étiquette. */
  apply(x: number, y: number): void {
    if (x !== this.x) {
      this.x = x;
      this.node.style.left = `${String(x)}px`;
    }
    if (y !== this.y) {
      this.y = y;
      this.node.style.top = `${String(y)}px`;
    }
  }
}

/** Remplit le bandeau (touches en `<kbd>`). */
function renderHint(container: HTMLElement, line: HintLine): void {
  container.replaceChildren();
  for (const segments of line) {
    const item = el('span', 'ui-hint-item', container);
    for (const segment of segments) {
      if (segment.kind === 'key') {
        el('kbd', '', item).textContent = segment.text;
      } else {
        item.append(segment.text);
      }
    }
  }
}

/**
 * Construit l'interface dans `options.root` et la relie au niveau et au traducteur.
 * @param options conteneur, niveau, traducteur et canvas.
 */
export function createUi(options: UiOptions): Ui {
  const { root, level, translator: tr, canvas, onMenu, onNext } = options;
  const builder = createViewModelBuilder(tr, level.snapshot.levelId);
  const showsTeaser = level.snapshot.levelId === 'level1';
  const hasIntegral = level.snapshot.levelId === 'level2';
  const layout = createLayout();
  let geometry: Readonly<UiGeometry> | null = null;
  let helpOpen = false;
  let boardOpen = false;
  /** Vrai si l'aide ou le tableau (une seule fenêtre modale à la fois) tient le jeu en pause. */
  let pausedByModal = false;
  let modalOpener: HTMLElement | null = null;

  root.classList.add('ui');

  // --- Barre du haut ---
  const top = el('header', 'ui-top', root);
  const brand = el('div', 'ui-brand', top);
  const title = new TextSlot(el('p', 'ui-title', brand));
  const kpTag = new TextSlot(el('p', 'ui-kp-tag num', brand));
  const tools = el('div', 'ui-tools', top);
  const pupitreButton = el('button', 'ui-btn ui-pupitre-btn', tools);
  pupitreButton.type = 'button';
  pupitreButton.setAttribute('aria-controls', 'ui-pupitre');
  pupitreButton.setAttribute('aria-haspopup', 'dialog');
  const pupitreButtonText = new TextSlot(pupitreButton);
  const pupitreButtonLabel = new AttrSlot(pupitreButton, 'aria-label');
  const pupitreButtonExpanded = new AttrSlot(pupitreButton, 'aria-expanded');
  const helpButton = el('button', 'ui-btn ui-help-btn', tools);
  helpButton.type = 'button';
  helpButton.textContent = '?';
  helpButton.setAttribute('aria-controls', 'ui-help');
  const helpButtonLabel = new AttrSlot(helpButton, 'aria-label');
  const helpButtonExpanded = new AttrSlot(helpButton, 'aria-expanded');
  const langButton = el('button', 'ui-btn ui-lang', tools);
  langButton.type = 'button';
  langButton.setAttribute('aria-describedby', 'ui-lang-desc');
  const langText = el('span', '', langButton);
  const langTextSlot = new TextSlot(langText);
  const langAttr = new AttrSlot(langText, 'lang');
  const langDesc = el('span', 'ui-sr', tools);
  langDesc.id = 'ui-lang-desc';
  const langDescSlot = new TextSlot(langDesc);
  const menuButton = el('button', 'ui-btn ui-menu', tools);
  menuButton.type = 'button';
  const menuText = new TextSlot(menuButton);
  const pauseButton = el('button', 'ui-btn ui-pause', tools);
  pauseButton.type = 'button';
  const pauseText = new TextSlot(pauseButton);

  const rotate = new TextSlot(el('p', 'ui-rotate ui-paper', root));

  // --- Chevalet : zone cliquable qui ouvre le tableau d'école ---
  const boardHit = el('button', 'ui-board-hit', root);
  boardHit.type = 'button';
  boardHit.hidden = true;
  boardHit.setAttribute('aria-controls', 'ui-board');
  boardHit.setAttribute('aria-haspopup', 'dialog');
  const boardHitLabel = new AttrSlot(boardHit, 'aria-label');
  const boardHitRect = new RectSlot(boardHit);

  // --- Aide des commandes ---
  const help = el('section', 'ui-paper ui-help', root);
  help.id = 'ui-help';
  help.setAttribute('role', 'dialog');
  help.setAttribute('aria-modal', 'true');
  help.setAttribute('aria-labelledby', 'ui-help-title');
  help.hidden = true;
  const helpTitleNode = el('h2', '', help);
  helpTitleNode.id = 'ui-help-title';
  const helpTitle = new TextSlot(helpTitleNode);
  const helpList = el('ul', '', help);
  const helpClose = el('button', 'ui-btn', help);
  helpClose.type = 'button';
  const helpCloseText = new TextSlot(helpClose);
  let helpLines: readonly string[] = [];
  const helpBox = new BoxSlot(help);

  // --- Tableau d'école (fenêtre modale en grand) ---
  const boardBackdrop = el('div', 'ui-board-backdrop', root);
  boardBackdrop.hidden = true;
  const board = el('section', 'ui-board', boardBackdrop);
  board.id = 'ui-board';
  board.setAttribute('role', 'dialog');
  board.setAttribute('aria-modal', 'true');
  board.setAttribute('aria-labelledby', 'ui-board-title');
  const boardHead = el('header', 'ui-board-head', board);
  const boardTitleNode = el('h2', '', boardHead);
  boardTitleNode.id = 'ui-board-title';
  const boardTitle = new TextSlot(boardTitleNode);
  const boardClose = el('button', 'ui-btn ui-board-close', boardHead);
  boardClose.type = 'button';
  const boardCloseText = new TextSlot(boardClose);
  const boardBody = el('div', 'ui-board-body', board);
  // Contenu construit à l'ouverture et à chaque changement de langue ; valeurs réécrites en direct.
  let boardBuiltFor = '';
  let boardKpSlot: TextSlot | null = null;
  let boardKiSlot: TextSlot | null = null;
  let boardKpShown = Number.NaN;
  let boardKiShown = Number.NaN;

  // --- Bulle ---
  const bubbleNode = el('p', 'ui-paper ui-bubble', root);
  const bubble = new TextSlot(bubbleNode);
  const bubbleBox = new BoxSlot(bubbleNode);

  // --- Mesures du trajet ---
  const readout = el('section', 'ui-paper ui-readout', root);
  readout.setAttribute('role', 'group');
  const readoutLabel = new AttrSlot(readout, 'aria-label');
  const time = new TextSlot(el('p', 'num', readout));
  const error = new TextSlot(el('p', 'num', readout));
  // Ligne réservée aux lecteurs d'écran (niveau 2) : la valeur voyante est posée sur la jauge I.
  const integralReadoutNode = el('p', 'ui-sr num', readout);
  integralReadoutNode.hidden = !hasIntegral;
  const integralReadout = new TextSlot(integralReadoutNode);
  const satNode = el('p', 'ui-saturated', readout);
  const saturated = new TextSlot(satNode);
  const legend = el('details', 'ui-legend', readout);
  const legendSummary = el('summary', '', legend);
  const legendTitle = new TextSlot(legendSummary);
  // Choix explicite du joueur (clic ou clavier sur le résumé) ; null : état par défaut du modèle.
  let legendChoice: boolean | null = null;
  legendSummary.addEventListener('click', () => {
    legendChoice = !legend.open;
  });
  const legendList = el('ul', '', legend);
  const legendItems: TextSlot[] = [];
  for (const kind of hasIntegral
    ? ['setpoint', 'position', 'error', 'integral']
    : ['setpoint', 'position', 'error']) {
    const li = el('li', `ui-legend-${kind}`, legendList);
    el('span', 'ui-swatch', li).setAttribute('aria-hidden', 'true');
    legendItems.push(new TextSlot(el('span', '', li)));
  }
  const readoutBox = new BoxSlot(readout);
  // Étiquettes permanentes de la jauge du terme intégral et de son échelle (aria-hidden : le
  // panneau des mesures dit déjà la même chose aux lecteurs d'écran). Cachées tant que la
  // géométrie manque. La force du moteur n'a plus de jauge dans la scène : elle se lit sur le
  // pupitre de contrôle.
  const gaugeLabel = (className: string): HTMLParagraphElement => {
    const node = el('p', className, root);
    node.setAttribute('aria-hidden', 'true');
    node.hidden = true;
    return node;
  };
  const gaugeMaxNode = gaugeLabel('ui-gauge-tag');
  const gaugeMax = new TextSlot(gaugeMaxNode);
  const gaugeMaxPoint = new PointSlot(gaugeMaxNode);
  const gaugeWeightNode = gaugeLabel('ui-gauge-tag');
  const gaugeWeight = new TextSlot(gaugeWeightNode);
  const gaugeWeightPoint = new PointSlot(gaugeWeightNode);
  // Jauge du terme intégral (niveau 2) : légende avant le lancement, « I : … N » ensuite.
  const integralTitleNode = gaugeLabel('ui-igauge-title');
  const integralTitle = new TextSlot(integralTitleNode);
  const integralTitlePoint = new PointSlot(integralTitleNode);
  const integralValueNode = gaugeLabel('ui-igauge-title ui-igauge-value num');
  const integralValue = new TextSlot(integralValueNode);
  const integralValuePoint = new PointSlot(integralValueNode);

  // --- Issue ---
  const outcome = el('section', 'ui-paper ui-outcome', root);
  outcome.setAttribute('aria-labelledby', 'ui-outcome-title');
  const outcomeTitleNode = el('h2', '', outcome);
  outcomeTitleNode.id = 'ui-outcome-title';
  const outcomeTitle = new TextSlot(outcomeTitleNode);
  const outcomeMessage = new TextSlot(el('p', '', outcome));
  const formulaNode = el('p', 'ui-formula', outcome);
  const formula = new TextSlot(formulaNode);
  const teaserNode = el('p', 'ui-small', outcome);
  const teaser = new TextSlot(teaserNode);
  // Les boutons vivent dans un pied collé en bas du panneau : visibles même s'il défile (A-02).
  const outcomeActions = el('div', 'ui-outcome-actions', outcome);
  let outcomeNext: HTMLButtonElement | null = null;
  let outcomeNextText: TextSlot | null = null;
  if (onNext !== undefined) {
    outcomeNext = el('button', 'ui-btn ui-primary ui-next', outcomeActions);
    outcomeNext.type = 'button';
    outcomeNextText = new TextSlot(outcomeNext);
  }
  const outcomeButton = el('button', 'ui-btn ui-primary', outcomeActions);
  outcomeButton.type = 'button';
  const outcomeButtonText = new TextSlot(outcomeButton);
  const outcomeMenu = el('button', 'ui-btn ui-menu', outcomeActions);
  outcomeMenu.type = 'button';
  const outcomeMenuText = new TextSlot(outcomeMenu);
  const outcomeBox = new BoxSlot(outcome);
  const dimensionNode = el('p', 'ui-dimension num', root);
  const dimension = new TextSlot(dimensionNode);
  const dimensionPoint = new PointSlot(dimensionNode);

  // --- Bandeau d'aide ---
  const banner = el('section', 'ui-paper ui-banner', root);
  const bannerLabel = new AttrSlot(banner, 'aria-label');
  const bannerLine = el('p', '', banner);
  let shownHint: HintLine | null = null;
  const bannerBox = new BoxSlot(banner);

  // --- Commandes tactiles ---
  const touch = el('div', 'ui-touch', root);
  touch.setAttribute('role', 'group');
  const touchLabel = new AttrSlot(touch, 'aria-label');
  const touchLeft = el('button', 'ui-btn ui-touch-btn', touch);
  touchLeft.type = 'button';
  touchLeft.textContent = '◀';
  const touchLeftLabel = new AttrSlot(touchLeft, 'aria-label');
  const touchRight = el('button', 'ui-btn ui-touch-btn', touch);
  touchRight.type = 'button';
  touchRight.textContent = '▶';
  const touchRightLabel = new AttrSlot(touchRight, 'aria-label');
  const touchAction = el('button', 'ui-btn ui-touch-btn ui-touch-action', touch);
  touchAction.type = 'button';
  const touchActionText = new TextSlot(touchAction);

  // --- Région des annonces ---
  const live = el('div', 'ui-sr', root);
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  const liveLabel = new AttrSlot(live, 'aria-label');

  // Dans un niveau, le canvas porte le nom du niveau (il est masqué hors niveau, spec T-017 §3.4).
  canvas.removeAttribute('aria-hidden');
  const canvasLabel = new AttrSlot(canvas, 'aria-label');
  let shownLocale = '';
  let previousOutcome = false;
  let gaugeTitleVisible = true;
  let integralVisible = false;
  let topPaused = false;
  // Issue repliée dans la bande du bas : le pupitre est ouvert et l'issue affichée.
  let outcomeDocked = false;

  const announce = (text: string): void => {
    const line = document.createElement('p');
    line.textContent = text;
    live.append(line);
    while (live.childElementCount > LIVE_HISTORY) {
      live.firstElementChild?.remove();
    }
  };
  // Annonce de lancement différée jusqu'au départ réel du trajet (R4) ; objet alloué une fois.
  const launchGate = createLaunchGate();
  const launchEvent: GameEvent = { type: 'launch', k: 0, outcome: null, attempt: 0 };
  const onEvent = (event: Readonly<GameEvent>): void => {
    if (!admitEvent(launchGate, event, level.snapshot.phase)) {
      return;
    }
    const text = announcementFor(event, level.snapshot, tr);
    if (text !== null) {
      announce(text);
    }
  };

  // Pupitre de contrôle : créé caché, les rappels ne sont appelés qu'après la construction.
  const pupitre: Pupitre = creerPupitre({
    racine: root,
    level,
    traducteur: tr,
    annoncer: announce,
    colonnes: creerColonnesTrajet(),
    bloque: () => commandsBlocked(helpOpen, boardOpen),
    apresCommande: () => {
      update();
    },
    fermer: () => {
      setPupitre(false);
    },
  });

  /** Rend le focus au document s'il est dans `container`. */
  const releaseFocus = (container: HTMLElement): void => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && container.contains(active)) {
      active.blur();
    }
  };

  const apply = (vm: Readonly<ViewModel>): void => {
    const t = vm.texts;
    if (vm.locale !== shownLocale) {
      shownLocale = vm.locale;
      helpLines = [];
    }
    title.set(t.title);
    kpTag.set(vm.kpTag);
    helpButtonLabel.set(vm.helpOpen ? t.helpHide : t.helpShow);
    helpButtonExpanded.set(vm.helpOpen ? 'true' : 'false');
    langTextSlot.set(t.languageButton);
    langAttr.set(vm.otherLocale);
    langDescSlot.set(t.languageDescription);
    pauseText.set(vm.paused ? t.resume : t.pause);
    menuText.set(t.menu);
    outcomeMenuText.set(t.menu);
    show(menuButton, onMenu !== undefined && vm.paused);
    if (vm.paused !== topPaused) {
      topPaused = vm.paused;
      top.classList.toggle('is-paused', vm.paused);
    }
    show(outcomeMenu, onMenu !== undefined);
    rotate.set(t.rotateHint);
    canvasLabel.set(t.canvasLabel);
    liveLabel.set(t.liveLabel);

    // Chevalet et tableau d'école.
    boardHitLabel.set(t.boardOpen);
    show(boardBackdrop, vm.boardOpen);
    boardTitle.set(t.boardTitle);
    boardCloseText.set(t.boardClose);
    if (vm.boardOpen) {
      const levelId = level.snapshot.levelId;
      const key = `${vm.locale}|${levelId}`;
      if (boardBuiltFor !== key) {
        boardBuiltFor = key;
        const nodes: BoardValueNodes = renderBoard(
          document,
          boardBody,
          buildBoardSections(tr, levelId),
        );
        boardKpSlot = nodes.kp === undefined ? null : new TextSlot(nodes.kp);
        boardKiSlot = nodes.ki === undefined ? null : new TextSlot(nodes.ki);
        boardKpShown = Number.NaN;
        boardKiShown = Number.NaN;
      }
      const { kp: kpNow, ki: kiNow } = level.snapshot;
      if (kpNow !== boardKpShown || kiNow !== boardKiShown) {
        boardKpShown = kpNow;
        boardKiShown = kiNow;
        const values = boardValues(tr, levelId, kpNow, kiNow);
        boardKpSlot?.set(values.kp);
        boardKiSlot?.set(values.ki);
      }
    }

    // Aide.
    show(help, vm.helpOpen);
    helpTitle.set(t.helpTitle);
    helpCloseText.set(t.helpClose);
    if (helpLines !== t.helpLines) {
      helpLines = t.helpLines;
      helpList.replaceChildren();
      for (const line of helpLines) {
        el('li', '', helpList).textContent = line;
      }
    }

    // Bulle.
    show(bubbleNode, vm.bubble !== '');
    bubble.set(vm.bubble);

    // Bandeau.
    bannerLabel.set(t.hintLabel);
    if (vm.hint !== shownHint) {
      shownHint = vm.hint;
      renderHint(bannerLine, vm.hint);
    }

    // Mesures.
    show(readout, vm.readoutVisible);
    readoutLabel.set(t.readoutLabel);
    time.set(vm.time);
    error.set(vm.error);
    saturated.set(t.saturated);
    show(satNode, vm.saturated);
    legendTitle.set(t.legendTitle);
    const legendOpen = legendChoice ?? vm.legendOpenByDefault;
    if (legend.open !== legendOpen) {
      legend.open = legendOpen;
    }
    for (let i = 0; i < legendItems.length; i += 1) {
      legendItems[i]?.set(t.legendLines[i] ?? '');
    }
    // La légende de la jauge I cède la place à « I : … N » dès le lancement.
    gaugeMax.set(t.gaugeMax);
    gaugeWeight.set(t.gaugeWeight);
    gaugeTitleVisible = !vm.readoutVisible;
    integralTitle.set(t.integralTitle);
    integralValue.set(vm.integral);
    integralReadout.set(vm.integralReadout);
    integralVisible = hasIntegral && vm.readoutVisible;

    // Issue.
    show(outcome, vm.outcomeVisible);
    outcome.classList.toggle('is-win', vm.outcome === 'win');
    outcomeTitle.set(vm.outcomeTitle);
    outcomeMessage.set(vm.outcomeMessage);
    formula.set(vm.formula);
    show(formulaNode, vm.formula !== '');
    teaser.set(t.teaser);
    show(teaserNode, vm.outcome === 'win' && showsTeaser);
    if (outcomeNext !== null && outcomeNextText !== null) {
      outcomeNextText.set(t.nextLevel);
      show(outcomeNext, vm.outcome === 'win');
      enable(outcomeNext, !vm.paused);
      if (vm.paused && document.activeElement === outcomeNext) {
        pauseButton.focus({ preventScroll: true });
      }
    }
    outcomeButtonText.set(vm.outcomeButton);
    enable(outcomeButton, !vm.paused);
    if (vm.paused && document.activeElement === outcomeButton) {
      pauseButton.focus({ preventScroll: true });
    }
    show(dimensionNode, vm.dimension !== '');
    dimension.set(vm.dimension);

    // Tactile.
    touchLabel.set(t.touchLabel);
    touchLeftLabel.set(t.moveLeft);
    touchRightLabel.set(t.moveRight);
    touchActionText.set(t.action);

    // Pupitre de contrôle : bouton de la barre du haut, issue repliée sous le pupitre ouvert.
    pupitreButtonText.set(t.pupitreButton);
    pupitreButtonLabel.set(t.pupitreLabel);
    pupitreButtonExpanded.set(pupitre.visible ? 'true' : 'false');
    outcomeDocked = pupitre.visible && vm.outcomeVisible;
    outcome.classList.toggle('is-docked', outcomeDocked);
    show(banner, !outcomeDocked);

    // Focus de l'issue.
    if (!vm.outcomeVisible) {
      releaseFocus(outcome);
    } else if (!previousOutcome) {
      // Réussite avec un niveau suivant : l'action naturelle a le focus ; sinon « Rejouer ».
      (outcomeNext !== null && vm.outcome === 'win' ? outcomeNext : outcomeButton).focus({
        preventScroll: true,
      });
    }
    previousOutcome = vm.outcomeVisible;
  };

  const place = (g: Readonly<UiGeometry>): void => {
    computeLayout(g, layout);
    const h = g.height;
    bannerBox.apply(layout.banner, h);
    bubbleBox.apply(layout.bubble, h);
    if (outcomeDocked) {
      dockOutcome(layout.outcome, g.width, h);
    }
    outcomeBox.apply(layout.outcome, h);
    readoutBox.apply(layout.readout, h);
    helpBox.apply(layout.help, h);
    const tl = g.boardTopLeft;
    const br = g.boardBottomRight;
    // Zone d'au moins BOARD_HIT_MIN px de côté (portrait : le chevalet y est tout petit), centrée.
    const hitWidth = Math.max(BOARD_HIT_MIN, br.x - tl.x);
    const hitHeight = Math.max(BOARD_HIT_MIN, br.y - tl.y);
    boardHitRect.apply(
      Math.round((tl.x + br.x - hitWidth) / 2),
      Math.round((tl.y + br.y - hitHeight) / 2),
      Math.round(hitWidth),
      Math.round(hitHeight),
    );
    show(boardHit, true);
    dimensionPoint.apply(layout.dimension.x, layout.dimension.y);
    gaugeMaxPoint.apply(layout.gaugeMax.x, layout.gaugeMax.y);
    gaugeWeightPoint.apply(layout.gaugeWeight.x, layout.gaugeWeight.y);
    integralTitlePoint.apply(layout.iGauge.x, layout.iGauge.y);
    integralValuePoint.apply(layout.iGauge.x, layout.iGauge.y);
    show(integralTitleNode, hasIntegral && gaugeTitleVisible);
    show(integralValueNode, integralVisible);
    // L'échelle (« 5000 N max », « poids ») n'existe qu'avec la jauge I, au niveau 2.
    show(gaugeMaxNode, hasIntegral);
    show(gaugeWeightNode, hasIntegral);
  };

  let destroyed = false;
  const update = (g?: Readonly<UiGeometry>): void => {
    if (destroyed) {
      return;
    }
    if (g !== undefined) {
      geometry = g;
    }
    if (releaseLaunch(launchGate, level.snapshot.phase)) {
      const text = announcementFor(launchEvent, level.snapshot, tr);
      if (text !== null) {
        announce(text);
      }
    }
    level.drainEvents(onEvent);
    if (pausedByModal && level.snapshot.phase !== 'paused') {
      pausedByModal = false;
    }
    pupitre.update(geometry?.width ?? window.innerWidth, geometry?.height ?? window.innerHeight);
    apply(builder.build(level.snapshot, ui));
    if (geometry !== null) {
      place(geometry);
    }
  };

  /** Vrai si l'élément ne peut pas recevoir le focus (désactivé ou masqué). */
  const isDisabled = (node: HTMLElement): boolean =>
    (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) && node.disabled
      ? true
      : node.closest('[hidden]') !== null;

  /** Fenêtre modale ouverte, ou `null`. */
  const currentModal = (): ModalKind | null => (helpOpen ? 'help' : boardOpen ? 'board' : null);

  /**
   * Passe d'une fenêtre modale à l'autre (ou à aucune) : une seule pause est tenue pour les deux,
   * le focus entre dans la nouvelle fenêtre et revient à son origine à la fermeture.
   */
  const setModal = (next: ModalKind | null): void => {
    const current = currentModal();
    if (next === current) {
      return;
    }
    // Lu avant la mise à jour : masquer une fenêtre fait perdre le focus qu'elle contient.
    const active = document.activeElement;
    const focusInside = help.contains(active) || boardBackdrop.contains(active);
    const decision = modalPauseDecision(current, next, level.snapshot.phase, pausedByModal);
    pausedByModal = decision.pausedByHelp;
    if (decision.action === 'pause') {
      level.pause();
    } else if (decision.action === 'resume') {
      level.resume();
    }
    helpOpen = next === 'help';
    boardOpen = next === 'board';
    if (current === null) {
      modalOpener = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    update();
    if (next === 'help') {
      helpClose.focus({ preventScroll: true });
    } else if (next === 'board') {
      boardClose.focus({ preventScroll: true });
    } else if (focusInside || active === document.body) {
      const fallback = current === 'board' && !boardHit.hidden ? boardHit : helpButton;
      const back =
        modalOpener?.isConnected === true && !isDisabled(modalOpener) ? modalOpener : null;
      (back ?? fallback).focus({ preventScroll: true });
      modalOpener = null;
    }
  };
  const setHelp = (open: boolean): void => {
    if (open) {
      setModal('help');
    } else if (helpOpen) {
      setModal(null);
    }
  };
  const setBoard = (open: boolean): void => {
    if (open) {
      setModal('board');
    } else if (boardOpen) {
      setModal(null);
    }
  };
  /** Phase effective (en pause : celle qui reprendra) et pause. */
  const effective = (): { phase: LevelPhase; paused: boolean } => {
    const snap = level.snapshot;
    const paused = snap.phase === 'paused';
    return { phase: paused && snap.resumePhase !== null ? snap.resumePhase : snap.phase, paused };
  };
  /**
   * Ouvre ou ferme le pupitre. Il ne met jamais le jeu en pause. En approche, l'ouvrir passe par
   * `level.interact()` (phase de réglage, le pupitre s'ouvre seul) ; en phase de réglage, le fermer
   * aussi (comme Échap avant lui) ; ailleurs, il s'ouvre et se ferme en lecture seule.
   */
  function setPupitre(open: boolean): void {
    if (open === pupitre.visible) {
      return;
    }
    const { phase, paused } = effective();
    if (open) {
      if (phase === 'approach' && !paused) {
        level.interact();
      } else {
        pupitre.setLecture(true);
      }
    } else if (pupitre.lectureOuverte) {
      pupitre.setLecture(false);
    } else if (phase === 'tuning' && !paused) {
      level.interact();
    }
    update();
  }

  const ui: Ui = {
    get helpOpen(): boolean {
      return helpOpen;
    },
    get boardOpen(): boolean {
      return boardOpen;
    },
    get pupitreOpen(): boolean {
      return pupitre.visible;
    },
    get pupitreLecture(): boolean {
      return pupitre.lectureOuverte;
    },
    update,
    setHelp,
    setBoard,
    setPupitre,
    destroy,
  };

  // --- Événements ---
  const blocked = (): boolean => commandsBlocked(helpOpen, boardOpen);
  const run = (command: () => unknown): void => {
    if (blocked()) {
      return;
    }
    command();
    update();
  };
  helpButton.addEventListener('click', () => {
    setHelp(!helpOpen);
  });
  helpClose.addEventListener('click', () => {
    setHelp(false);
  });
  // Tableau d'école : le deuxième clic d'un double-clic est ignoré (A-01), y compris sur le fond
  // (le clic hors du tableau le ferme, il ne doit pas fermer ce que le premier clic vient d'ouvrir).
  boardHit.addEventListener('click', (event) => {
    if (event.detail > 1) {
      return;
    }
    setBoard(true);
  });
  boardClose.addEventListener('click', () => {
    setBoard(false);
  });
  boardBackdrop.addEventListener('click', (event) => {
    if (event.target === boardBackdrop && event.detail <= 1) {
      setBoard(false);
    }
  });
  // Piège de focus : Tab et Maj+Tab restent dans la fenêtre modale ouverte (aide ou tableau).
  // Tableau ouvert : les flèches et Page préc. / Page suiv. font défiler son texte (le jeu, lui,
  // ne reçoit aucune commande).
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (boardOpen && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const page = boardBody.clientHeight * 0.9;
      const step: Readonly<Record<string, number>> = {
        ArrowDown: 40,
        ArrowUp: -40,
        PageDown: page,
        PageUp: -page,
      };
      const by = step[event.code];
      if (by !== undefined) {
        boardBody.scrollBy({ top: by });
      } else if (event.code === 'Home' || event.code === 'End') {
        boardBody.scrollTo({ top: event.code === 'Home' ? 0 : boardBody.scrollHeight });
      }
    }
    if (event.key !== 'Tab') {
      return;
    }
    if (!helpOpen && !boardOpen) {
      // Pupitre ouvert : le focus reste sur ses contrôles (et sur les boutons de l'issue repliée,
      // pour que « Rejouer », « Niveau suivant » et « Menu » restent atteignables au clavier).
      if (!pupitre.visible) {
        return;
      }
      const controls = [
        ...pupitre.focalisables(),
        ...(outcomeDocked
          ? Array.from(outcome.querySelectorAll<HTMLElement>('button:not(:disabled)')).filter(
              (node) => !node.hidden,
            )
          : []),
      ];
      // Les boutons de l'issue sont avant le pupitre dans le document : l'ordre est explicite.
      const index = controls.findIndex((node) => node === document.activeElement);
      const next = cycleFocusIndex(index, controls.length, event.shiftKey);
      if (next !== null) {
        event.preventDefault();
        controls[next]?.focus({ preventScroll: true });
      }
      return;
    }
    const modal = boardOpen ? board : help;
    const controls = Array.from(modal.querySelectorAll<HTMLElement>('button'));
    const index = controls.findIndex((node) => node === document.activeElement);
    const next = trapFocusIndex(index, controls.length, event.shiftKey);
    if (next !== null) {
      event.preventDefault();
      controls[next]?.focus({ preventScroll: true });
    }
  };
  document.addEventListener('keydown', onDocumentKeyDown);
  langButton.addEventListener('click', () => {
    tr.setLocale(builder.model.otherLocale);
  });
  const unsubscribeLocale = tr.subscribe(() => {
    update();
  });
  pauseButton.addEventListener('click', () => {
    run(() => (level.snapshot.phase === 'paused' ? level.resume() : level.pause()));
  });
  const leaveToMenu = (): void => {
    if (!blocked()) {
      onMenu?.();
    }
  };
  menuButton.addEventListener('click', leaveToMenu);
  outcomeMenu.addEventListener('click', leaveToMenu);
  // Comme les autres boutons de navigation : le deuxième clic d'un double-clic est ignoré (A-01).
  outcomeNext?.addEventListener('click', (event) => {
    if (event.detail > 1 || blocked()) {
      return;
    }
    onNext?.();
  });
  pupitreButton.addEventListener('click', () => {
    if (!blocked()) {
      setPupitre(!pupitre.visible);
    }
  });
  outcomeButton.addEventListener('click', () => {
    run(() => level.restart());
  });

  // Tactile : ◀ ▶ tant que le doigt appuie ; « Action » selon la phase (régler, lancer, passer
  // l'embarquement ou la sortie, recommencer, reprendre).
  const hold = (button: HTMLButtonElement, move: () => unknown): void => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      run(move);
    });
    const release = (): void => {
      run(() => level.stop());
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  };
  hold(touchLeft, () => level.moveLeft());
  hold(touchRight, () => level.moveRight());
  touchAction.addEventListener('click', () => {
    run(() => {
      switch (level.snapshot.phase) {
        case 'approach':
          return level.interact();
        case 'tuning':
          return level.launch();
        case 'boarding':
        case 'exit':
          return level.skipAnimation();
        case 'outcome':
          // Aucune action : « Rejouer », « Recommencer », « Niveau suivant » et « Menu » servent à cela
          // (un second appui sur la sortie ne doit pas annuler l'issue, R5).
          return null;
        case 'paused':
          return level.resume();
        case 'trip':
          return null;
      }
    });
  });

  // Souris : clic sur la console = interagir (en approche).
  const onCanvasClick = (event: MouseEvent): void => {
    if (!blocked() && geometry !== null) {
      const rect = canvas.getBoundingClientRect();
      if (isConsoleHit(event.clientX - rect.left, event.clientY - rect.top, geometry)) {
        // Le pupitre de la scène : en approche il ouvre le réglage ; ailleurs, sa lecture seule.
        setPupitre(true);
      }
    }
  };
  canvas.addEventListener('click', onCanvasClick);

  function destroy(): void {
    if (destroyed) {
      return;
    }
    destroyed = true;
    document.removeEventListener('keydown', onDocumentKeyDown);
    canvas.removeEventListener('click', onCanvasClick);
    unsubscribeLocale();
    helpOpen = false;
    boardOpen = false;
    pupitre.destroy();
    root.replaceChildren();
    root.classList.remove('ui');
    canvas.setAttribute('aria-hidden', 'true');
  }

  update();
  return ui;
}
