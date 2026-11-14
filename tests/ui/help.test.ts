/**
 * Règles pures de l'aide des commandes (K19, K21) : pause à l'ouverture pendant un trajet,
 * reprise seulement si l'aide a mis en pause, piège de focus.
 */
import { describe, expect, it } from 'vitest';
import type { LevelPhase } from '../../src/game';
import { helpPauseDecision, trapFocusIndex } from '../../src/ui/help';

const PHASES: readonly LevelPhase[] = ['approach', 'tuning', 'trip', 'outcome', 'paused'];

describe('helpPauseDecision', () => {
  it("à l'ouverture, met en pause pendant un trajet seulement", () => {
    for (const phase of PHASES) {
      const d = helpPauseDecision(true, phase, false);
      expect(d.action, phase).toBe(phase === 'trip' ? 'pause' : 'none');
      expect(d.pausedByHelp, phase).toBe(phase === 'trip');
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
