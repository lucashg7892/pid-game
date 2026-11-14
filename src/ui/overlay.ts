/**
 * Interface DOM superposée au canvas (T-010) : barre du haut (titre, Kp, aide, langue, pause),
 * bulle, bandeau d'aide, panneau Kp, mesures du trajet et légende, issue, cote chiffrée, aide des
 * commandes, commandes tactiles, invite d'orientation et région `aria-live`.
 *
 * Le DOM est construit une fois. À chaque image, {@link Ui.update} reconstruit le modèle de vue
 * (pur, `view-model.ts`), consomme les événements du niveau (annonces), calcule la disposition
 * (pure, `layout.ts`) puis n'écrit que les nœuds dont la valeur a changé (comparaison avant
 * écriture) : rien n'est écrit, et presque rien n'est alloué, en régime établi.
 */
import { KP_MAX, KP_MIN, KP_STEP, type GameEvent, type Level1 } from '../game';
import type { Translator } from '../i18n';
import { announcementFor } from './announce';
import type { HintLine } from './hints';
import { helpPauseDecision, trapFocusIndex } from './help';
import {
  computeLayout,
  createLayout,
  isConsoleHit,
  type PanelBox,
  type UiGeometry,
} from './layout';
import { createViewModelBuilder, type ViewModel } from './view-model';
import './ui.css';

/** Options de {@link createUi}. */
export interface UiOptions {
  /** Conteneur de l'interface (ajouté au document par l'appelant). */
  readonly root: HTMLElement;
  /** Niveau piloté. */
  readonly level: Level1;
  /** Traducteur (langue courante, bascule). */
  readonly translator: Translator;
  /** Canvas de la scène (libellé accessible, clic sur la console). */
  readonly canvas: HTMLCanvasElement;
}

/** Interface en cours. */
export interface Ui {
  /** Vrai si l'aide des commandes est ouverte. */
  readonly helpOpen: boolean;
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
  const { root, level, translator: tr, canvas } = options;
  const builder = createViewModelBuilder(tr);
  const layout = createLayout();
  let geometry: Readonly<UiGeometry> | null = null;
  let helpOpen = false;
  let pausedByHelp = false;
  let helpOpener: HTMLElement | null = null;

  root.classList.add('ui');

  // --- Barre du haut ---
  const top = el('header', 'ui-top', root);
  const brand = el('div', 'ui-brand', top);
  const title = new TextSlot(el('p', 'ui-title', brand));
  const kpTag = new TextSlot(el('p', 'ui-kp-tag num', brand));
  const tools = el('div', 'ui-tools', top);
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
  const pauseButton = el('button', 'ui-btn ui-pause', tools);
  pauseButton.type = 'button';
  const pauseText = new TextSlot(pauseButton);

  const rotate = new TextSlot(el('p', 'ui-rotate ui-paper', root));

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

  // --- Bulle ---
  const bubbleNode = el('p', 'ui-paper ui-bubble', root);
  const bubble = new TextSlot(bubbleNode);
  const bubbleBox = new BoxSlot(bubbleNode);

  // --- Panneau Kp ---
  const panel = el('form', 'ui-paper ui-panel', root);
  panel.noValidate = true;
  panel.setAttribute('role', 'group');
  const panelLabel = new AttrSlot(panel, 'aria-label');
  const panelTitleNode = el('h2', 'ui-panel-title', panel);
  panelTitleNode.id = 'ui-kp-title';
  const panelTitle = new TextSlot(panelTitleNode);
  const kpValue = new TextSlot(el('p', 'ui-kp-value num', panel));
  kpValue.node.setAttribute('aria-hidden', 'true');
  const row = el('div', 'ui-kp-row', panel);
  const minus = el('button', 'ui-btn ui-kp-step', row);
  minus.type = 'button';
  minus.textContent = '−';
  const minusLabel = new AttrSlot(minus, 'aria-label');
  const range = el('input', 'ui-kp-range', row);
  range.type = 'range';
  range.min = String(KP_MIN);
  range.max = String(KP_MAX);
  range.step = String(KP_STEP);
  range.setAttribute('aria-labelledby', 'ui-kp-title');
  const rangeText = new AttrSlot(range, 'aria-valuetext');
  const plus = el('button', 'ui-btn ui-kp-step', row);
  plus.type = 'button';
  plus.textContent = '+';
  const plusLabel = new AttrSlot(plus, 'aria-label');
  const field = el('label', 'ui-kp-field', panel);
  const fieldText = new TextSlot(el('span', '', field));
  const numberInput = el('input', 'num', field);
  numberInput.type = 'number';
  numberInput.min = String(KP_MIN);
  numberInput.max = String(KP_MAX);
  numberInput.step = String(KP_STEP);
  numberInput.inputMode = 'numeric';
  const kpHelp = new TextSlot(el('p', 'ui-small', panel));
  const kpRange = new TextSlot(el('p', 'ui-small', panel));
  const lockedNode = el('p', 'ui-locked', panel);
  const locked = new TextSlot(lockedNode);
  const actions = el('div', 'ui-actions', panel);
  const launch = el('button', 'ui-btn ui-primary', actions);
  launch.type = 'button';
  const launchText = new TextSlot(launch);
  const panelRestart = el('button', 'ui-btn', actions);
  panelRestart.type = 'button';
  const panelRestartText = new TextSlot(panelRestart);
  const panelBox = new BoxSlot(panel);

  // --- Mesures du trajet ---
  const readout = el('section', 'ui-paper ui-readout', root);
  readout.setAttribute('role', 'group');
  const readoutLabel = new AttrSlot(readout, 'aria-label');
  const time = new TextSlot(el('p', 'num', readout));
  const error = new TextSlot(el('p', 'num', readout));
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
  for (const kind of ['setpoint', 'position', 'error', 'force']) {
    const li = el('li', `ui-legend-${kind}`, legendList);
    el('span', 'ui-swatch', li).setAttribute('aria-hidden', 'true');
    legendItems.push(new TextSlot(el('span', '', li)));
  }
  const readoutBox = new BoxSlot(readout);
  const forceNode = el('p', 'ui-force num', root);
  const force = new TextSlot(forceNode);
  const forcePoint = new PointSlot(forceNode);
  // Étiquettes permanentes de la jauge (aria-hidden : le panneau des mesures et le nom de la
  // jauge disent déjà la même chose aux lecteurs d'écran). Cachées tant que la géométrie manque.
  const gaugeLabel = (className: string): HTMLParagraphElement => {
    const node = el('p', className, root);
    node.setAttribute('aria-hidden', 'true');
    node.hidden = true;
    return node;
  };
  const gaugeTitleNode = gaugeLabel('ui-gauge-title');
  const gaugeTitle = new TextSlot(gaugeTitleNode);
  const gaugeTitlePoint = new PointSlot(gaugeTitleNode);
  const gaugeMaxNode = gaugeLabel('ui-gauge-tag');
  const gaugeMax = new TextSlot(gaugeMaxNode);
  const gaugeMaxPoint = new PointSlot(gaugeMaxNode);
  const gaugeWeightNode = gaugeLabel('ui-gauge-tag');
  const gaugeWeight = new TextSlot(gaugeWeightNode);
  const gaugeWeightPoint = new PointSlot(gaugeWeightNode);

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
  const soonNode = el('p', 'ui-small', outcome);
  const soon = new TextSlot(soonNode);
  const outcomeButton = el('button', 'ui-btn ui-primary', outcome);
  outcomeButton.type = 'button';
  const outcomeButtonText = new TextSlot(outcomeButton);
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

  const canvasLabel = new AttrSlot(canvas, 'aria-label');
  let shownLocale = '';
  let shownKp = Number.NaN;
  let previousPhase = '';
  let previousPaused = false;
  let previousOutcome = false;
  let gaugeTitleVisible = true;

  const announce = (text: string): void => {
    const line = document.createElement('p');
    line.textContent = text;
    live.append(line);
    while (live.childElementCount > LIVE_HISTORY) {
      live.firstElementChild?.remove();
    }
  };
  const onEvent = (event: Readonly<GameEvent>): void => {
    const text = announcementFor(event, level.snapshot, tr);
    if (text !== null) {
      announce(text);
    }
  };

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
      document.documentElement.lang = vm.locale;
      document.title = t.title;
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
    rotate.set(t.rotateHint);
    canvasLabel.set(t.canvasLabel);
    liveLabel.set(t.liveLabel);

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

    // Panneau Kp.
    show(panel, vm.panelOpen);
    panelLabel.set(t.panelLabel);
    panelTitle.set(t.kpLabel);
    kpValue.set(vm.kpValue);
    minusLabel.set(t.kpDecrease);
    plusLabel.set(t.kpIncrease);
    fieldText.set(t.kpField);
    rangeText.set(vm.kpValueText);
    if (vm.kp !== shownKp) {
      shownKp = vm.kp;
      range.valueAsNumber = vm.kp;
      if (document.activeElement !== numberInput) {
        numberInput.valueAsNumber = vm.kp;
      }
    }
    const editable = vm.panelOpen && !vm.panelLocked;
    enable(range, editable);
    enable(numberInput, editable);
    enable(minus, editable);
    enable(plus, editable);
    enable(launch, editable);
    kpHelp.set(t.kpHelp);
    kpRange.set(t.kpRange);
    locked.set(t.kpLocked);
    show(lockedNode, vm.panelLocked);
    launchText.set(t.launch);
    show(launch, vm.phase === 'tuning');
    panelRestartText.set(t.restart);
    show(panelRestart, vm.phase === 'trip');
    enable(panelRestart, !vm.paused);

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
    show(forceNode, vm.readoutVisible);
    force.set(vm.force);
    forceNode.classList.toggle('is-saturated', vm.saturated);
    // La légende de la jauge cède la place à « Force : … N » dès le lancement.
    gaugeTitle.set(t.gaugeTitle);
    gaugeMax.set(t.gaugeMax);
    gaugeWeight.set(t.gaugeWeight);
    gaugeTitleVisible = !vm.readoutVisible;

    // Issue.
    show(outcome, vm.outcomeVisible);
    outcome.classList.toggle('is-win', vm.outcome === 'win');
    outcomeTitle.set(vm.outcomeTitle);
    outcomeMessage.set(vm.outcomeMessage);
    formula.set(vm.formula);
    show(formulaNode, vm.formula !== '');
    teaser.set(t.teaser);
    soon.set(t.comingSoon);
    show(teaserNode, vm.outcome === 'win');
    show(soonNode, vm.outcome === 'win');
    outcomeButtonText.set(vm.outcomeButton);
    show(dimensionNode, vm.dimension !== '');
    dimension.set(vm.dimension);

    // Tactile.
    touchLabel.set(t.touchLabel);
    touchLeftLabel.set(t.moveLeft);
    touchRightLabel.set(t.moveRight);
    touchActionText.set(t.action);

    // Focus : sur le curseur à l'ouverture du réglage, rendu au document à la fermeture.
    const phase = vm.phase;
    const tuningActive = phase === 'tuning' && !vm.paused;
    const wasTuningActive = previousPhase === 'tuning' && !previousPaused;
    if (tuningActive && !wasTuningActive) {
      range.focus({ preventScroll: true });
    } else if (!tuningActive && wasTuningActive) {
      releaseFocus(panel);
    }
    if (!vm.outcomeVisible) {
      releaseFocus(outcome);
    } else if (!previousOutcome) {
      outcomeButton.focus({ preventScroll: true });
    }
    previousOutcome = vm.outcomeVisible;
    previousPhase = phase;
    previousPaused = vm.paused;
  };

  const place = (g: Readonly<UiGeometry>): void => {
    computeLayout(g, layout);
    const h = g.height;
    bannerBox.apply(layout.banner, h);
    bubbleBox.apply(layout.bubble, h);
    panelBox.apply(layout.panel, h);
    outcomeBox.apply(layout.outcome, h);
    readoutBox.apply(layout.readout, h);
    helpBox.apply(layout.help, h);
    forcePoint.apply(layout.force.x, layout.force.y);
    dimensionPoint.apply(layout.dimension.x, layout.dimension.y);
    gaugeTitlePoint.apply(layout.force.x, layout.force.y);
    gaugeMaxPoint.apply(layout.gaugeMax.x, layout.gaugeMax.y);
    gaugeWeightPoint.apply(layout.gaugeWeight.x, layout.gaugeWeight.y);
    show(gaugeTitleNode, gaugeTitleVisible);
    show(gaugeMaxNode, true);
    show(gaugeWeightNode, true);
  };

  const update = (g?: Readonly<UiGeometry>): void => {
    if (g !== undefined) {
      geometry = g;
    }
    level.drainEvents(onEvent);
    if (pausedByHelp && level.snapshot.phase !== 'paused') {
      pausedByHelp = false;
    }
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

  const setHelp = (open: boolean): void => {
    if (open === helpOpen) {
      return;
    }
    // Lu avant la mise à jour : masquer l'aide fait perdre le focus qu'elle contient.
    const active = document.activeElement;
    const focusInside = help.contains(active);
    const decision = helpPauseDecision(open, level.snapshot.phase, pausedByHelp);
    pausedByHelp = decision.pausedByHelp;
    if (decision.action === 'pause') {
      level.pause();
    } else if (decision.action === 'resume') {
      level.resume();
    }
    helpOpen = open;
    if (open) {
      helpOpener = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    update();
    if (open) {
      helpClose.focus({ preventScroll: true });
    } else if (focusInside || active === document.body) {
      const back = helpOpener?.isConnected === true && !isDisabled(helpOpener) ? helpOpener : null;
      (back ?? helpButton).focus({ preventScroll: true });
      helpOpener = null;
    }
  };

  const ui: Ui = {
    get helpOpen(): boolean {
      return helpOpen;
    },
    update,
    setHelp,
  };

  // --- Événements ---
  const run = (command: () => unknown): void => {
    command();
    update();
  };
  helpButton.addEventListener('click', () => {
    setHelp(!helpOpen);
  });
  helpClose.addEventListener('click', () => {
    setHelp(false);
  });
  // Piège de focus : Tab et Maj+Tab restent dans l'aide tant qu'elle est ouverte.
  document.addEventListener('keydown', (event) => {
    if (!helpOpen || event.key !== 'Tab') {
      return;
    }
    const controls = Array.from(help.querySelectorAll<HTMLElement>('button'));
    const index = controls.findIndex((node) => node === document.activeElement);
    const next = trapFocusIndex(index, controls.length, event.shiftKey);
    if (next !== null) {
      event.preventDefault();
      controls[next]?.focus({ preventScroll: true });
    }
  });
  langButton.addEventListener('click', () => {
    tr.setLocale(builder.model.otherLocale);
  });
  tr.subscribe(() => {
    update();
  });
  pauseButton.addEventListener('click', () => {
    run(() => (level.snapshot.phase === 'paused' ? level.resume() : level.pause()));
  });
  minus.addEventListener('click', () => {
    run(() => level.adjustKp(-KP_STEP));
  });
  plus.addEventListener('click', () => {
    run(() => level.adjustKp(KP_STEP));
  });
  range.addEventListener('input', () => {
    run(() => level.setKp(range.valueAsNumber));
  });
  const commitNumber = (): void => {
    const value = numberInput.valueAsNumber;
    if (Number.isFinite(value)) {
      level.setKp(value);
    }
    numberInput.valueAsNumber = level.snapshot.kp;
    update();
  };
  numberInput.addEventListener('change', commitNumber);
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    commitNumber();
  });
  launch.addEventListener('click', () => {
    run(() => level.launch());
  });
  panelRestart.addEventListener('click', () => {
    run(() => level.restart());
  });
  outcomeButton.addEventListener('click', () => {
    run(() => level.restart());
  });

  // Tactile : ◀ ▶ tant que le doigt appuie ; « Action » selon la phase.
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
        case 'outcome':
          return level.restart();
        case 'paused':
          return level.resume();
        case 'trip':
          return null;
      }
    });
  });

  // Souris : clic sur la console = interagir (en approche).
  canvas.addEventListener('click', (event) => {
    if (geometry !== null && level.snapshot.phase === 'approach') {
      const rect = canvas.getBoundingClientRect();
      if (isConsoleHit(event.clientX - rect.left, event.clientY - rect.top, geometry)) {
        run(() => level.interact());
      }
    }
  });

  update();
  return ui;
}
