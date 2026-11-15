/**
 * Annonces de la région `aria-live` (CA-2 de T-010) : une phrase par événement, en FR et en EN,
 * avec la valeur de e à l'issue ; chaque événement n'est consommé qu'une fois.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent, Level1 } from '../../src/game';
import { announcementFor, formatError, formatKp } from '../../src/ui/announce';
import { NB, advance, finished, tr, tuning } from './helpers';

/** Consomme les événements en attente et renvoie les annonces (copie des champs). */
function drain(level: Level1, locale: 'fr' | 'en'): string[] {
  const t = tr(locale);
  const out: string[] = [];
  level.drainEvents((event) => {
    const text = announcementFor(event, level.snapshot, t);
    if (text !== null) out.push(text);
  });
  return out;
}

describe('annonces', () => {
  it('ouverture du réglage, lancement, première saturation (une seule fois), victoire', () => {
    const level = tuning(2500);
    expect(drain(level, 'fr')).toEqual(['Prêt. Règle Kp, puis lance l’ascenseur.']);
    level.launch();
    advance(level, 4);
    expect(level.snapshot.outcome).toBe('win');
    expect(drain(level, 'fr')).toEqual([
      `Lancement avec Kp = 2500${NB}N/m${NB}: la consigne passe de 0 à 3${NB}m.`,
      `Moteur à fond\u202F! Il ne peut pas fournir plus de 5000${NB}N${NB}: c’est la saturation.`,
      `Réussi\u202F! La cabine s’est stabilisée 0,20${NB}m sous le plateau d’arrivée.`,
    ]);
    expect(drain(level, 'fr')).toEqual([]);
  });

  it('avec animations (D32) : la victoire n’est annoncée qu’à la fin de la sortie', () => {
    const level = tuning(2500, true);
    drain(level, 'fr');
    level.launch();
    expect(drain(level, 'fr')).toEqual([
      `Lancement avec Kp = 2500${NB}N/m${NB}: la consigne passe de 0 à 3${NB}m.`,
    ]);
    for (let i = 0; i < 10_000 && level.snapshot.phase !== 'exit'; i += 1) level.update(1 / 60);
    expect(drain(level, 'fr')).toEqual([
      `Moteur à fond\u202F! Il ne peut pas fournir plus de 5000${NB}N${NB}: c’est la saturation.`,
    ]);
    // Pendant toute la sortie : aucune annonce.
    for (let i = 0; i < 10_000 && level.snapshot.phase === 'exit'; i += 1) {
      expect(drain(level, 'fr')).toEqual([]);
      level.update(1 / 60);
    }
    expect(drain(level, 'fr')).toEqual([
      `Réussi\u202F! La cabine s’est stabilisée 0,20${NB}m sous le plateau d’arrivée.`,
    ]);
  });

  it('issues en anglais avec la valeur de e', () => {
    const step = finished(800);
    expect(drain(step, 'en').at(-1)).toBe(
      `Failed: the lift stopped 0.61${NB}m below the ledge, more than the 0.5${NB}m the stick figure can step up.`,
    );
    const bonk = finished(7000);
    expect(drain(bonk, 'en').at(-1)).toBe(
      `Failed: the lift went above 3.36${NB}m and hit the beam. Error: −0.37${NB}m`,
    );
    const noLift = finished(100);
    expect(drain(noLift, 'fr').at(-1)).toBe(
      `Échec${NB}: avec Kp = 100${NB}N/m, la cabine n’a pas décollé. Erreur${NB}: 3,00${NB}m`,
    );
  });

  it('pause, reprise, recommencer ; fermeture du réglage sans annonce', () => {
    const level = finished(2500);
    drain(level, 'fr');
    level.pause();
    level.resume();
    level.restart();
    expect(drain(level, 'en')).toEqual([
      'Game paused.',
      'Game resumed.',
      'Lift back on the ground. Adjust Kp and launch again.',
    ]);
    level.interact(); // referme le panneau
    expect(drain(level, 'fr')).toEqual([]);
  });

  it('événement d’issue sans issue : aucune annonce ; formatage', () => {
    const level = tuning(2500);
    const event: GameEvent = { type: 'outcome', k: 0, outcome: null, attempt: 1 };
    expect(announcementFor(event, level.snapshot, tr('fr'))).toBeNull();
    expect(formatKp(tr('fr'), 2500)).toBe('2500');
    expect(formatError(tr('fr'), 0.1964)).toBe('0,20');
    expect(formatError(tr('en'), 0.1964)).toBe('0.20');
    expect(formatError(tr('en'), Number.NaN)).toBe('0.00');
  });
});
