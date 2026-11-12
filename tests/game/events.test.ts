import { describe, expect, it } from 'vitest';
import {
  EVENT_QUEUE_CAPACITY,
  createEventQueue,
  createLevel1,
  type GameEvent,
  type Level1,
} from '../../src/game';
import { finishTrip, reachConsole } from './helpers';

/** Consomme et copie les événements en attente. */
function drain(level: Level1): GameEvent[] {
  const out: GameEvent[] = [];
  level.drainEvents((e) => out.push({ ...e }));
  return out;
}

describe('CA-6 : événements', () => {
  it('Kp = 2500 : chaque événement une seule fois, première saturation unique (23 pas saturés)', () => {
    const level = createLevel1();
    level.setKp(2500);
    reachConsole(level);
    expect(drain(level)).toEqual([{ type: 'tuningOpened', k: 0, outcome: null, attempt: 1 }]);
    expect(drain(level)).toEqual([]);
    level.launch();
    const all: GameEvent[] = drain(level);
    while (level.snapshot.phase === 'trip') {
      level.update(1 / 60);
      all.push(...drain(level));
    }
    for (let i = 0; i < 30; i++) {
      level.update(1 / 60);
      all.push(...drain(level));
    }
    expect(all).toEqual([
      { type: 'launch', k: 0, outcome: null, attempt: 1 },
      { type: 'firstSaturation', k: 1, outcome: null, attempt: 1 },
      { type: 'outcome', k: 291, outcome: 'win', attempt: 1 },
    ]);
    expect(level.snapshot.saturatedSteps).toBe(23);
    expect(level.snapshot.saturationSeen).toBe(true);
    // Pause, reprise, reset : une fois chacun.
    level.pause();
    level.pause();
    level.resume();
    level.resume();
    level.restart();
    level.restart();
    expect(drain(level)).toEqual([
      { type: 'pause', k: 291, outcome: null, attempt: 1 },
      { type: 'resume', k: 291, outcome: null, attempt: 1 },
      { type: 'reset', k: 0, outcome: null, attempt: 2 },
    ]);
    expect(level.snapshot.saturationSeen).toBe(false);
    expect(level.snapshot.saturatedSteps).toBe(0);
    // Second trajet : la première saturation est de nouveau annoncée, une fois.
    finishTrip(level);
    const second = drain(level);
    expect(second.filter((e) => e.type === 'firstSaturation')).toHaveLength(1);
    expect(second.map((e) => e.type)).toEqual(['launch', 'firstSaturation', 'outcome']);
  });

  it('Kp = 1500 : aucun événement de saturation', () => {
    const level = createLevel1();
    level.setKp(1500);
    reachConsole(level);
    drain(level);
    const r = finishTrip(level);
    expect(r.outcome).toBe('step');
    const events = drain(level);
    expect(events.map((e) => e.type)).toEqual(['launch', 'outcome']);
    expect(level.snapshot.saturationSeen).toBe(false);
    expect(level.snapshot.saturatedSteps).toBe(0);
  });

  it('tuningClosed à la fermeture du panneau', () => {
    const level = createLevel1();
    reachConsole(level);
    level.interact();
    expect(drain(level).map((e) => e.type)).toEqual(['tuningOpened', 'tuningClosed']);
  });
});

describe("file d'événements", () => {
  it('débordement : les plus anciens sont perdus et comptés', () => {
    const q = createEventQueue();
    for (let i = 0; i < EVENT_QUEUE_CAPACITY + 5; i++) q.push('pause', i, null, 1);
    expect(q.length).toBe(EVENT_QUEUE_CAPACITY);
    expect(q.dropped).toBe(5);
    const ks: number[] = [];
    expect(q.drain((e) => ks.push(e.k))).toBe(EVENT_QUEUE_CAPACITY);
    expect(ks[0]).toBe(5);
    expect(ks[ks.length - 1]).toBe(EVENT_QUEUE_CAPACITY + 4);
    expect(q.length).toBe(0);
  });

  it('un événement ajouté pendant la visite est rendu au prochain appel', () => {
    const q = createEventQueue();
    q.push('launch', 0, null, 1);
    const seen: string[] = [];
    q.drain((e) => {
      seen.push(e.type);
      q.push('outcome', 9, 'win', 1);
    });
    expect(seen).toEqual(['launch']);
    expect(q.length).toBe(1);
    q.drain((e) => seen.push(`${e.type}:${String(e.outcome)}`));
    expect(seen).toEqual(['launch', 'outcome:win']);
  });
});
