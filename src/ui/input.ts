/**
 * Commandes clavier définitives (spec T-001 §6, T-010) : écoute le clavier et la perte de focus
 * de la fenêtre, traduit chaque frappe par la fonction pure {@link keyToIntent} et exécute
 * l'intention sur le niveau ou l'interface.
 *
 * Marche : tant qu'une touche de marche est enfoncée (←/→, ou `KeyA`/`KeyD` par position) ;
 * relâchement = arrêt. Perte de focus (`blur`, onglet masqué) : arrêt de la marche et, pendant un
 * trajet, mise en pause.
 */
import type { Level1 } from '../game';
import { keyToIntent, kpDeltaOf, walkSideOf, type FocusTarget } from './keys';
import type { Ui } from './overlay';

/**
 * Cible du focus, au sens de {@link keyToIntent}.
 * @param active élément actif du document.
 */
export function focusTargetOf(active: Element | null): FocusTarget {
  if (active instanceof HTMLInputElement) {
    if (active.type === 'range') {
      return 'range';
    }
    return active.type === 'number' || active.type === 'text' ? 'number' : 'button';
  }
  if (active instanceof HTMLTextAreaElement) {
    return 'number';
  }
  if (
    active instanceof HTMLButtonElement ||
    active instanceof HTMLAnchorElement ||
    active instanceof HTMLSelectElement ||
    active?.tagName === 'SUMMARY'
  ) {
    return 'button';
  }
  return 'none';
}

/**
 * Branche le clavier et la perte de focus sur `target` (en pratique `window`).
 * @param level niveau piloté.
 * @param ui interface (aide, mise à jour immédiate après une commande).
 * @param target cible des écouteurs.
 * @returns fonction qui retire les écouteurs.
 */
export function bindKeyboard(level: Level1, ui: Ui, target: Window): () => void {
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

  const onKeyDown = (event: KeyboardEvent): void => {
    const intent = keyToIntent({
      code: event.code,
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      repeat: event.repeat,
      phase: level.snapshot.phase,
      focus: focusTargetOf(document.activeElement),
      helpOpen: ui.helpOpen,
    });
    if (intent === 'none') {
      return;
    }
    event.preventDefault();
    switch (intent) {
      case 'block':
        return;
      case 'walkLeft':
        left = true;
        walk();
        break;
      case 'walkRight':
        right = true;
        walk();
        break;
      case 'interact':
        level.interact();
        break;
      case 'launch':
        level.launch();
        break;
      case 'kpUp':
      case 'kpDown':
      case 'kpUpBig':
      case 'kpDownBig':
        level.adjustKp(kpDeltaOf(intent));
        break;
      case 'restart':
        level.restart();
        break;
      case 'pause':
        left = false;
        right = false;
        walk();
        level.pause();
        break;
      case 'resume':
        level.resume();
        break;
      case 'closeHelp':
        ui.setHelp(false);
        return;
    }
    ui.update();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const side = walkSideOf(event.code);
    if (side === null) {
      return;
    }
    if (side === 'left') {
      left = false;
    } else {
      right = false;
    }
    walk();
    ui.update();
  };

  const onFocusLost = (): void => {
    left = false;
    right = false;
    walk();
    if (level.snapshot.phase === 'trip') {
      level.pause();
    }
    ui.update();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      onFocusLost();
    }
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onFocusLost);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onFocusLost);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
