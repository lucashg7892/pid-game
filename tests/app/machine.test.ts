import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  createAppMachine,
  nextLevelId,
  type AppMachine,
  type AppResult,
  type AppState,
  type LevelEntry,
  type ScreenId,
} from '../../src/app';

const CATALOG: readonly LevelEntry[] = [
  { id: 'level1', playable: true },
  { id: 'soon', playable: false },
];

type Command = 'play' | 'openLevel' | 'back' | 'leaveLevel' | 'nextLevel';

function send(machine: AppMachine, command: Command): AppResult {
  return command === 'openLevel' ? machine.openLevel('level1') : machine[command]();
}

/** Amène une machine neuve sur l'écran voulu. */
function at(screen: ScreenId): AppMachine {
  const machine = createAppMachine(CATALOG);
  if (screen !== 'title') {
    machine.play();
  }
  if (screen === 'level') {
    machine.openLevel('level1');
  }
  return machine;
}

describe('catalogue', () => {
  it('contient les niveaux 1 et 2, jouables, dans cet ordre', () => {
    expect(LEVELS).toEqual([
      { id: 'level1', playable: true },
      { id: 'level2', playable: true },
    ]);
  });

  it('le menu ouvre le niveau 2 comme le niveau 1', () => {
    const machine = createAppMachine(LEVELS);
    machine.play();
    expect(machine.openLevel('level2')).toBe('ok');
    expect(machine.state).toEqual({ screen: 'level', levelId: 'level2' });
    expect(machine.leaveLevel()).toBe('ok');
    expect(machine.state).toEqual({ screen: 'menu', levelId: null });
  });
});

describe('machine d’application : table de transitions', () => {
  it('démarre sur le titre, sans niveau', () => {
    expect(createAppMachine(CATALOG).state).toEqual({ screen: 'title', levelId: null });
  });

  const table: ReadonlyArray<[ScreenId, Command, AppResult, AppState]> = [
    ['title', 'play', 'ok', { screen: 'menu', levelId: null }],
    ['title', 'openLevel', 'ignored', { screen: 'title', levelId: null }],
    ['title', 'back', 'ignored', { screen: 'title', levelId: null }],
    ['title', 'leaveLevel', 'ignored', { screen: 'title', levelId: null }],
    ['title', 'nextLevel', 'ignored', { screen: 'title', levelId: null }],
    ['menu', 'play', 'ignored', { screen: 'menu', levelId: null }],
    ['menu', 'openLevel', 'ok', { screen: 'level', levelId: 'level1' }],
    ['menu', 'back', 'ok', { screen: 'title', levelId: null }],
    ['menu', 'leaveLevel', 'ignored', { screen: 'menu', levelId: null }],
    ['menu', 'nextLevel', 'ignored', { screen: 'menu', levelId: null }],
    ['level', 'play', 'ignored', { screen: 'level', levelId: 'level1' }],
    ['level', 'openLevel', 'ignored', { screen: 'level', levelId: 'level1' }],
    ['level', 'back', 'ignored', { screen: 'level', levelId: 'level1' }],
    ['level', 'leaveLevel', 'ok', { screen: 'menu', levelId: null }],
    // Le catalogue de test n'a pas de niveau jouable après level1 : rien à enchaîner.
    ['level', 'nextLevel', 'ignored', { screen: 'level', levelId: 'level1' }],
  ];
  it.each(table)('%s + %s : %s', (from, command, result, expected) => {
    const machine = at(from);
    expect(send(machine, command)).toBe(result);
    expect(machine.state).toEqual(expected);
  });

  it('openLevel : identifiant inconnu ou non jouable → invalid, état inchangé', () => {
    const machine = at('menu');
    expect(machine.openLevel('nope')).toBe('invalid');
    expect(machine.openLevel('soon')).toBe('invalid');
    expect(machine.state).toEqual({ screen: 'menu', levelId: null });
  });

  it('levelId est non nul si et seulement si on est dans un niveau', () => {
    const machine = createAppMachine(CATALOG);
    const steps: Command[] = ['play', 'openLevel', 'leaveLevel', 'back', 'openLevel', 'play'];
    for (const step of steps) {
      send(machine, step);
      expect(machine.state.levelId !== null).toBe(machine.state.screen === 'level');
    }
  });
});

describe('niveau suivant', () => {
  it('nextLevelId : suivant jouable du catalogue, null pour le dernier ou un inconnu', () => {
    expect(nextLevelId('level1')).toBe('level2');
    expect(nextLevelId('level2')).toBeNull();
    expect(nextLevelId('nope')).toBeNull();
    expect(nextLevelId('level1', CATALOG)).toBeNull();
    const gap: readonly LevelEntry[] = [
      { id: 'a', playable: true },
      { id: 'b', playable: false },
      { id: 'c', playable: true },
    ];
    expect(nextLevelId('a', gap)).toBe('c');
    expect(nextLevelId('c', gap)).toBeNull();
  });

  it('nextLevel : level1 → level2, notifié avec l’écran précédent « level » ; level2 : ignoré', () => {
    const machine = createAppMachine(LEVELS);
    machine.play();
    machine.openLevel('level1');
    const seen: Array<[AppState, ScreenId]> = [];
    machine.subscribe((state, previous) => {
      seen.push([state, previous]);
    });
    expect(machine.nextLevel()).toBe('ok');
    expect(machine.state).toEqual({ screen: 'level', levelId: 'level2' });
    expect(machine.nextLevel()).toBe('ignored');
    expect(machine.state).toEqual({ screen: 'level', levelId: 'level2' });
    expect(seen).toEqual([[{ screen: 'level', levelId: 'level2' }, 'level']]);
  });

  it('nextLevel : deux commandes de suite ne sautent pas le niveau 2 vers un troisième', () => {
    const machine = createAppMachine(LEVELS);
    machine.play();
    machine.openLevel('level1');
    machine.nextLevel();
    machine.nextLevel();
    expect(machine.state.levelId).toBe('level2');
  });
});

describe('machine d’application : abonnement', () => {
  it('notifie après validation, avec l’écran précédent ; rien si ignoré', () => {
    const machine = createAppMachine(CATALOG);
    const seen: Array<[AppState, ScreenId]> = [];
    machine.subscribe((state, previous) => {
      seen.push([state, previous]);
    });
    machine.back();
    machine.openLevel('level1');
    expect(seen).toEqual([]);
    machine.play();
    machine.openLevel('level1');
    expect(seen).toEqual([
      [{ screen: 'menu', levelId: null }, 'title'],
      [{ screen: 'level', levelId: 'level1' }, 'menu'],
    ]);
  });

  it('le désabonnement arrête les notifications', () => {
    const machine = createAppMachine(CATALOG);
    let calls = 0;
    const off = machine.subscribe(() => {
      calls += 1;
    });
    machine.play();
    off();
    off();
    machine.back();
    expect(calls).toBe(1);
  });

  it('une commande reçue pendant une notification est exécutée après elle, dans l’ordre', () => {
    const machine = createAppMachine(CATALOG);
    const log: string[] = [];
    machine.subscribe((state) => {
      log.push(`A:${state.screen}`);
      if (state.screen === 'menu') {
        machine.openLevel('level1');
      }
    });
    machine.subscribe((state) => {
      log.push(`B:${state.screen}`);
    });
    expect(machine.play()).toBe('ok');
    expect(log).toEqual(['A:menu', 'B:menu', 'A:level', 'B:level']);
    expect(machine.state).toEqual({ screen: 'level', levelId: 'level1' });
  });
});
