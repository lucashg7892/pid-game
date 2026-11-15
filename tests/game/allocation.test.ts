import { describe, expect, it } from 'vitest';
import { createLevel1 } from '../../src/game';
import { createElevatorLoop, type LoopSample, type SteppableClosedLoop } from '../../src/sim';
import { reachConsole } from './helpers';

describe('CA-8 : pas d’allocation par image, aucune référence conservée', () => {
  it('instantané réutilisé : même objet sur 1000 images, toutes phases', () => {
    const level = createLevel1({ animations: false });
    const ref = level.snapshot;
    level.moveRight();
    for (let i = 0; i < 300; i++) expect(level.update(1 / 60)).toBe(ref);
    reachConsole(level);
    level.setKp(2500);
    level.launch();
    for (let i = 0; i < 700; i++) expect(level.update(1 / 60)).toBe(ref);
    expect(level.snapshot).toBe(ref);
    expect(level.snapshot.outcome).toBe('win');
  });

  it('journal du trajet préalloué : mêmes tableaux sur 1000 images, toutes phases, restart', () => {
    const level = createLevel1();
    const log = level.tripLog;
    const columns = [log.y, log.v, log.a, log.e, log.uCmd, log.uSat, log.p, log.i, log.saturated];
    const same = (): void => {
      expect(level.tripLog).toBe(log);
      [log.y, log.v, log.a, log.e, log.uCmd, log.uSat, log.p, log.i, log.saturated].forEach(
        (c, n) => {
          expect(c).toBe(columns[n]);
        },
      );
    };
    level.moveRight();
    for (let i = 0; i < 300; i++) level.update(1 / 60);
    reachConsole(level);
    level.setKp(2500);
    level.launch();
    for (let i = 0; i < 700; i++) {
      level.update(1 / 60);
      same();
    }
    expect(level.snapshot.phase).toBe('outcome');
    expect(log.count).toBe(level.snapshot.outcomeK);
    level.restart();
    level.setKp(8000);
    level.launch();
    for (let i = 0; i < 300; i++) level.update(1 / 60);
    same();
    expect(log.count).toBe(level.snapshot.outcomeK);
  });

  it("muter l'échantillon et l'état du noyau après coup ne change pas l'instantané", () => {
    let lastSample: LoopSample | null = null;
    let inner: SteppableClosedLoop | null = null;
    const level = createLevel1({
      animations: false,
      createLoop: (kp) => {
        const loop = createElevatorLoop({ kp });
        inner = loop;
        return {
          dt: loop.dt,
          x: loop.x,
          get k() {
            return loop.k;
          },
          get enabled() {
            return loop.enabled;
          },
          setEnabled: (on: boolean) => {
            loop.setEnabled(on);
          },
          reset: () => {
            loop.reset();
          },
          step: () => {
            const s = loop.step();
            lastSample = s;
            return s;
          },
        };
      },
    });
    level.setKp(2500);
    reachConsole(level);
    level.launch();
    level.update(0.05);
    const copy = { ...level.snapshot };
    expect(lastSample).not.toBeNull();
    const s = lastSample as unknown as LoopSample;
    s.uSat = -123;
    s.saturated = false;
    s.k = 999;
    s.y = 42;
    (s.x as Float64Array)[0] = 100;
    ((inner as unknown as SteppableClosedLoop).x as Float64Array)[1] = -7;
    expect(level.snapshot).toEqual(copy);
    expect(level.snapshot.cabinY).not.toBe(100);
  });
});
