/**
 * Touches des écrans titre et menu (spec T-017 §4.4) : toutes les touches × écrans × focus,
 * modificateurs ignorés.
 */
import { describe, expect, it } from 'vitest';
import type { ScreenId } from '../../src/app';
import {
  screenKeyToIntent,
  type ScreenKeyInput,
  type ScreenKeyIntent,
} from '../../src/ui/screen-keys';

const SCREENS: readonly ScreenId[] = ['title', 'menu', 'level'];
const CODES = [
  'Enter',
  'NumpadEnter',
  'Space',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'KeyE',
  'KeyR',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];
/** Menu à trois contrôles (deux niveaux et « Retour ») ; -1 : focus hors de la liste. */
const COUNT = 3;
const FOCUS_INDEXES = [-1, 0, 1, 2];

function intent(
  code: string,
  screen: ScreenId,
  focusIndex: number,
  mods: Partial<Pick<ScreenKeyInput, 'ctrlKey' | 'altKey' | 'metaKey' | 'repeat'>> = {},
): ScreenKeyIntent {
  return screenKeyToIntent({
    code,
    screen,
    focusIndex,
    focusCount: COUNT,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    ...mods,
  });
}

/** Résultat attendu, écrit à part de l'implémentation. */
function expected(code: string, screen: ScreenId, focusIndex: number): ScreenKeyIntent {
  if (screen !== 'menu') return 'none';
  if (code === 'Escape') return 'back';
  if (code === 'ArrowDown') {
    if (focusIndex === -1) return 'focusFirst';
    return focusIndex === COUNT - 1 ? 'block' : 'focusNext';
  }
  if (code === 'ArrowUp') {
    if (focusIndex === -1) return 'focusLast';
    return focusIndex === 0 ? 'block' : 'focusPrev';
  }
  return 'none';
}

describe('screenKeyToIntent : table complète', () => {
  for (const screen of SCREENS) {
    for (const focusIndex of FOCUS_INDEXES) {
      it(`${screen}, focus ${String(focusIndex)}`, () => {
        for (const code of CODES) {
          expect(intent(code, screen, focusIndex), code).toBe(expected(code, screen, focusIndex));
        }
      });
    }
  }
});

describe('screenKeyToIntent : cas notables', () => {
  it('Échap : rien sur le titre, retour depuis le menu', () => {
    expect(intent('Escape', 'title', 0)).toBe('none');
    expect(intent('Escape', 'menu', 0)).toBe('back');
    expect(intent('Escape', 'menu', -1)).toBe('back');
  });

  it('Entrée et Espace restent natifs sur le titre et le menu', () => {
    for (const screen of ['title', 'menu'] as const) {
      for (const code of ['Enter', 'NumpadEnter', 'Space']) {
        expect(intent(code, screen, 1), `${screen} ${code}`).toBe('none');
      }
    }
  });

  it('Entrée ou Espace avec repeat (A-01) : bloquées sur le titre et le menu, rien au niveau', () => {
    for (const screen of ['title', 'menu'] as const) {
      for (const code of ['Enter', 'NumpadEnter', 'Space']) {
        for (const focusIndex of FOCUS_INDEXES) {
          expect(intent(code, screen, focusIndex, { repeat: true }), `${screen} ${code}`).toBe(
            'block',
          );
        }
      }
    }
    expect(intent('Enter', 'level', 0, { repeat: true })).toBe('none');
    // Échap répétée au menu : toujours « back » (le garde `repeat` est dans screens.ts).
    expect(intent('Escape', 'menu', 0, { repeat: true })).toBe('back');
  });

  it('flèches du menu : pas de bouclage, aux deux extrémités la page ne défile pas', () => {
    expect(intent('ArrowDown', 'menu', COUNT - 1)).toBe('block');
    expect(intent('ArrowUp', 'menu', 0)).toBe('block');
    expect(intent('ArrowDown', 'menu', 0)).toBe('focusNext');
    expect(intent('ArrowUp', 'menu', COUNT - 1)).toBe('focusPrev');
  });

  it('focusIndex hors bornes compte comme un focus hors de la liste', () => {
    expect(intent('ArrowDown', 'menu', COUNT)).toBe('focusFirst');
    expect(intent('ArrowUp', 'menu', 99)).toBe('focusLast');
  });

  it('Ctrl, Alt, Meta : aucune intention, pour toutes les touches', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      for (const screen of SCREENS) {
        for (const code of CODES) {
          for (const focusIndex of FOCUS_INDEXES) {
            expect(intent(code, screen, focusIndex, { [mod]: true }), `${mod} ${code}`).toBe(
              'none',
            );
          }
        }
      }
    }
  });
});
