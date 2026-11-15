/**
 * Règles pures de l'aide des commandes (K19, K21) : pause à l'ouverture pendant un trajet,
 * reprise seulement si l'aide a mis en pause, piège de focus.
 */
import { describe, expect, it } from 'vitest';
import type { LevelPhase } from '../../src/game';
import {
  commandsBlocked,
  helpPauseDecision,
  modalPauseDecision,
  trapFocusIndex,
  type ModalKind,
} from '../../src/ui/help';

const PHASES: readonly LevelPhase[] = [
  'approach',
  'tuning',
  'boarding',
  'trip',
  'exit',
  'outcome',
  'paused',
];
/** Phases où le jeu avance seul : l'aide les met en pause (embarquement, trajet, sortie). */
const RUNNING: readonly LevelPhase[] = ['boarding', 'trip', 'exit'];

describe('helpPauseDecision', () => {
  it("à l'ouverture, met en pause pendant l'embarquement, un trajet ou la sortie seulement", () => {
    for (const phase of PHASES) {
      const d = helpPauseDecision(true, phase, false);
      expect(d.action, phase).toBe(RUNNING.includes(phase) ? 'pause' : 'none');
      expect(d.pausedByHelp, phase).toBe(RUNNING.includes(phase));
    }
  });

  it("à la fermeture, reprend si l'aide avait mis en pause", () => {
    expect(helpPauseDecision(false, 'paused', true)).toEqual({
      action: 'resume',
      pausedByHelp: false,
    });
  });

  it('à la fermeture, ne reprend pas une pause du joueur', () => {
    expect(helpPauseDecision(false, 'paused', false)).toEqual({
      action: 'none',
      pausedByHelp: false,
    });
  });

  it("à la fermeture, ne fait rien si le jeu n'est plus en pause", () => {
    for (const phase of PHASES.filter((p) => p !== 'paused')) {
      expect(helpPauseDecision(false, phase, true).action, phase).toBe('none');
    }
  });
});

describe('trapFocusIndex', () => {
  it('laisse le natif entre deux contrôles', () => {
    expect(trapFocusIndex(1, 3, false)).toBeNull();
    expect(trapFocusIndex(1, 3, true)).toBeNull();
  });

  it('reboucle aux extrémités', () => {
    expect(trapFocusIndex(2, 3, false)).toBe(0);
    expect(trapFocusIndex(0, 3, true)).toBe(2);
    expect(trapFocusIndex(0, 1, false)).toBe(0);
    expect(trapFocusIndex(0, 1, true)).toBe(0);
  });

  it("ramène dans l'aide un focus qui en est sorti", () => {
    expect(trapFocusIndex(-1, 2, false)).toBe(0);
    expect(trapFocusIndex(-1, 2, true)).toBe(1);
  });

  it('ne fait rien sans contrôle', () => {
    expect(trapFocusIndex(-1, 0, false)).toBeNull();
  });
});

describe('commandsBlocked (K24)', () => {
  it("suspend les commandes du niveau tant que l'aide est ouverte", () => {
    expect(commandsBlocked(true)).toBe(true);
    expect(commandsBlocked(false)).toBe(false);
  });

  it("suspend aussi les commandes tant que le tableau d'école est ouvert (T-042)", () => {
    expect(commandsBlocked(false, true)).toBe(true);
    expect(commandsBlocked(true, true)).toBe(true);
    expect(commandsBlocked(false, false)).toBe(false);
  });
});

describe("modalPauseDecision : l'aide et le tableau partagent la pause (T-042)", () => {
  const KINDS: readonly ModalKind[] = ['help', 'board'];

  it("à l'ouverture depuis le jeu, applique la règle de l'aide, pour l'une et l'autre fenêtre", () => {
    for (const kind of KINDS) {
      for (const phase of PHASES) {
        expect(modalPauseDecision(null, kind, phase, false), `${kind} ${phase}`).toEqual(
          helpPauseDecision(true, phase, false),
        );
      }
    }
  });

  it('à la fermeture, reprend seulement la pause que la fenêtre a posée', () => {
    for (const kind of KINDS) {
      expect(modalPauseDecision(kind, null, 'paused', true)).toEqual({
        action: 'resume',
        pausedByHelp: false,
      });
      // Pause du joueur : jamais reprise.
      expect(modalPauseDecision(kind, null, 'paused', false)).toEqual({
        action: 'none',
        pausedByHelp: false,
      });
    }
  });

  it("passer de l'une à l'autre ne reprend ni ne remet en pause, et garde qui tient la pause", () => {
    for (const [from, to] of [
      ['help', 'board'],
      ['board', 'help'],
    ] as const) {
      for (const phase of PHASES) {
        expect(modalPauseDecision(from, to, phase, true), `${from}→${to} ${phase}`).toEqual({
          action: 'none',
          pausedByHelp: true,
        });
        expect(modalPauseDecision(from, to, phase, false), `${from}→${to} ${phase}`).toEqual({
          action: 'none',
          pausedByHelp: false,
        });
      }
    }
  });

  it('aucune fenêtre avant ni après : rien à faire', () => {
    expect(modalPauseDecision(null, null, 'trip', true)).toEqual({
      action: 'none',
      pausedByHelp: true,
    });
  });
});
