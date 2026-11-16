/**
 * Traduction touche → intention (CA-2 de T-010) : table complète touche × phase × focus,
 * modificateurs ignorés, champ numérique respecté, rien ne fait défiler la page.
 */
import { describe, expect, it } from 'vitest';
import type { LevelPhase } from '../../src/game';
import {
  KP_BIG_STEP,
  KP_SMALL_STEP,
  keyToIntent,
  kpDeltaOf,
  walkSideOf,
  type FocusTarget,
  type KeyInput,
  type KeyIntent,
} from '../../src/ui/keys';

const PHASES: readonly LevelPhase[] = [
  'approach',
  'tuning',
  'boarding',
  'trip',
  'exit',
  'outcome',
  'paused',
];
const FOCUSES: readonly FocusTarget[] = ['none', 'range', 'number', 'button'];

/** Touche : `code` et `key` d'un clavier QWERTY (sauf mention). */
interface Key {
  readonly code: string;
  readonly key: string;
}
const K = (code: string, key: string): Key => ({ code, key });

const ARROW_LEFT = K('ArrowLeft', 'ArrowLeft');
const ARROW_RIGHT = K('ArrowRight', 'ArrowRight');
const KEY_A = K('KeyA', 'a');
/** Touche A d'un clavier AZERTY (position de Q en QWERTY) : `code` KeyA, `key` « q ». */
const AZERTY_Q = K('KeyA', 'q');
const KEY_D = K('KeyD', 'd');
const KEY_E = K('KeyE', 'e');
const ENTER = K('Enter', 'Enter');
const NUMPAD_ENTER = K('NumpadEnter', 'Enter');
const SPACE = K('Space', ' ');
const PLUS = K('Equal', '+');
const EQUAL = K('Equal', '=');
const MINUS = K('Minus', '-');
const AZERTY_MINUS = K('Digit6', '-');
const UNICODE_MINUS = K('Minus', '−');
const NUMPAD_ADD = K('NumpadAdd', '+');
const NUMPAD_SUB = K('NumpadSubtract', '-');
const PAGE_UP = K('PageUp', 'PageUp');
const PAGE_DOWN = K('PageDown', 'PageDown');
const KEY_R = K('KeyR', 'r');
const ESCAPE = K('Escape', 'Escape');
const ARROW_UP = K('ArrowUp', 'ArrowUp');
const ARROW_DOWN = K('ArrowDown', 'ArrowDown');
const HOME = K('Home', 'Home');
const END = K('End', 'End');
const TAB = K('Tab', 'Tab');
const KEY_X = K('KeyX', 'x');
/** Q d'un clavier QWERTY (position de A en AZERTY) : pas une touche du jeu. */
const KEY_Q = K('KeyQ', 'q');

function intent(
  k: Key,
  phase: LevelPhase,
  focus: FocusTarget = 'none',
  extra: Partial<KeyInput> = {},
): KeyIntent {
  return keyToIntent({
    code: k.code,
    key: k.key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    phase,
    focus,
    helpOpen: false,
    boardOpen: false,
    pupitreLecture: false,
    ...extra,
  });
}

/** Intention attendue de E / Entrée / Espace selon la phase (hors champ numérique). */
const USE_BY_PHASE: Readonly<Record<LevelPhase, KeyIntent>> = {
  approach: 'interact',
  tuning: 'launch',
  boarding: 'skip',
  trip: 'block',
  exit: 'skip',
  outcome: 'block',
  paused: 'block',
};

/**
 * Intention attendue de E : celle de Entrée et Espace, sauf là où elles ne servent à rien (trajet,
 * issue, pause) : E y ouvre le pupitre de contrôle en lecture seule (T-049).
 */
const E_BY_PHASE: Readonly<Record<LevelPhase, KeyIntent>> = {
  ...USE_BY_PHASE,
  trip: 'openPupitre',
  outcome: 'openPupitre',
  paused: 'openPupitre',
};

describe('keyToIntent : table touche × phase × focus', () => {
  // Pour chaque touche : intention attendue selon (phase, focus).
  const table: readonly (readonly [string, Key, (p: LevelPhase, f: FocusTarget) => KeyIntent])[] = [
    ['←', ARROW_LEFT, (_p, f) => (f === 'number' || f === 'range' ? 'none' : 'walkLeft')],
    ['→', ARROW_RIGHT, (_p, f) => (f === 'number' || f === 'range' ? 'none' : 'walkRight')],
    ['A (QWERTY)', KEY_A, (_p, f) => (f === 'number' ? 'none' : 'walkLeft')],
    ['Q (AZERTY, code KeyA)', AZERTY_Q, (_p, f) => (f === 'number' ? 'none' : 'walkLeft')],
    ['D', KEY_D, (_p, f) => (f === 'number' ? 'none' : 'walkRight')],
    ['E', KEY_E, (p, f) => (f === 'number' ? 'none' : E_BY_PHASE[p])],
    ['Entrée', ENTER, (p, f) => (f === 'number' || f === 'button' ? 'none' : USE_BY_PHASE[p])],
    [
      'Entrée du pavé',
      NUMPAD_ENTER,
      (p, f) => (f === 'number' || f === 'button' ? 'none' : USE_BY_PHASE[p]),
    ],
    ['Espace', SPACE, (p, f) => (f === 'number' || f === 'button' ? 'none' : USE_BY_PHASE[p])],
    ['+', PLUS, (_p, f) => (f === 'number' ? 'none' : 'kpUp')],
    ['= (vaut +)', EQUAL, (_p, f) => (f === 'number' ? 'none' : 'kpUp')],
    ['+ du pavé', NUMPAD_ADD, (_p, f) => (f === 'number' ? 'none' : 'kpUp')],
    ['-', MINUS, (_p, f) => (f === 'number' ? 'none' : 'kpDown')],
    ['- (AZERTY)', AZERTY_MINUS, (_p, f) => (f === 'number' ? 'none' : 'kpDown')],
    ['− (U+2212)', UNICODE_MINUS, (_p, f) => (f === 'number' ? 'none' : 'kpDown')],
    ['- du pavé', NUMPAD_SUB, (_p, f) => (f === 'number' ? 'none' : 'kpDown')],
    ['Page préc.', PAGE_UP, (_p, f) => (f === 'number' ? 'none' : 'kpUpBig')],
    ['Page suiv.', PAGE_DOWN, (_p, f) => (f === 'number' ? 'none' : 'kpDownBig')],
    ['R', KEY_R, (_p, f) => (f === 'number' ? 'none' : 'restart')],
    [
      'Échap',
      ESCAPE,
      (p) => (p === 'paused' ? 'resume' : p === 'tuning' ? 'closeTuning' : 'pause'),
    ],
    ['↑', ARROW_UP, (_p, f) => (f === 'none' ? 'block' : 'none')],
    ['↓', ARROW_DOWN, (_p, f) => (f === 'none' ? 'block' : 'none')],
    ['Début', HOME, (_p, f) => (f === 'none' ? 'block' : 'none')],
    ['Fin', END, (_p, f) => (f === 'none' ? 'block' : 'none')],
    ['Tab', TAB, () => 'none'],
    ['X', KEY_X, () => 'none'],
    ['Q (QWERTY, code KeyQ)', KEY_Q, () => 'none'],
  ];

  for (const [name, key, expected] of table) {
    it(`${name} : ${String(PHASES.length * FOCUSES.length)} combinaisons`, () => {
      for (const phase of PHASES) {
        for (const focus of FOCUSES) {
          expect(intent(key, phase, focus), `${name} / ${phase} / ${focus}`).toBe(
            expected(phase, focus),
          );
        }
      }
    });
  }
});

describe('keyToIntent : règles transverses', () => {
  const ALL_KEYS = [
    ARROW_LEFT,
    ARROW_RIGHT,
    KEY_A,
    KEY_D,
    KEY_E,
    ENTER,
    SPACE,
    PLUS,
    MINUS,
    NUMPAD_ADD,
    NUMPAD_SUB,
    PAGE_UP,
    PAGE_DOWN,
    KEY_R,
    ESCAPE,
    ARROW_UP,
    HOME,
  ];

  it('Ctrl, Alt ou Meta enfoncée : aucune intention, quelle que soit la touche', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
      for (const key of ALL_KEYS) {
        for (const phase of PHASES) {
          expect(intent(key, phase, 'none', { [mod]: true }), `${mod}+${key.code}`).toBe('none');
        }
      }
    }
  });

  it('répétition automatique : E, Entrée, Espace et R ne répètent pas l’action', () => {
    for (const key of [KEY_E, ENTER, SPACE, KEY_R]) {
      for (const phase of PHASES) {
        expect(intent(key, phase, 'none', { repeat: true }), `${key.code}/${phase}`).toBe('block');
      }
    }
    // La marche et Kp acceptent la répétition (touche maintenue).
    expect(intent(KEY_D, 'approach', 'none', { repeat: true })).toBe('walkRight');
    expect(intent(PLUS, 'tuning', 'none', { repeat: true })).toBe('kpUp');
  });

  it('Échap maintenue (A-03) : la répétition ne produit aucune intention, aide ouverte ou non', () => {
    for (const phase of PHASES) {
      for (const focus of FOCUSES) {
        for (const helpOpen of [false, true]) {
          expect(intent(ESCAPE, phase, focus, { repeat: true, helpOpen })).toBe('block');
        }
      }
    }
    expect(intent(ESCAPE, 'approach')).toBe('pause');
  });

  it('Entrée ou Espace maintenue sur un bouton (A-01) : pas de clic synthétisé, première frappe native', () => {
    for (const key of [ENTER, NUMPAD_ENTER, SPACE]) {
      for (const phase of PHASES) {
        for (const helpOpen of [false, true]) {
          expect(intent(key, phase, 'button', { repeat: true, helpOpen })).toBe('block');
          expect(intent(key, phase, 'button', { helpOpen })).toBe('none');
        }
      }
    }
  });

  it('aide ouverte : Échap la ferme, sans pause, quelle que soit la phase et le focus', () => {
    for (const phase of PHASES) {
      for (const focus of FOCUSES) {
        expect(intent(ESCAPE, phase, focus, { helpOpen: true })).toBe('closeHelp');
      }
    }
  });

  it('aide ouverte (K24) : aucune commande du jeu au clavier, quelle que soit la phase et le focus', () => {
    const GAME_INTENTS: readonly KeyIntent[] = [
      'walkLeft',
      'walkRight',
      'interact',
      'launch',
      'skip',
      'kpUp',
      'kpDown',
      'kpUpBig',
      'kpDownBig',
      'restart',
      'pause',
      'resume',
      'closeTuning',
    ];
    for (const key of ALL_KEYS) {
      for (const phase of PHASES) {
        for (const focus of FOCUSES) {
          const got = intent(key, phase, focus, { helpOpen: true });
          expect(GAME_INTENTS, `${key.code}/${phase}/${focus}`).not.toContain(got);
        }
      }
    }
    // Touches du jeu : bloquées (preventDefault), même répétées.
    for (const key of [KEY_E, KEY_D, KEY_A, ARROW_LEFT, PLUS, MINUS, PAGE_UP, PAGE_DOWN, KEY_R]) {
      expect(intent(key, 'tuning', 'none', { helpOpen: true }), key.code).toBe('block');
      expect(intent(key, 'approach', 'button', { helpOpen: true }), key.code).toBe('block');
    }
    // Entrée et Espace sur un bouton de l'aide (« Fermer ») : comportement natif.
    for (const key of [ENTER, NUMPAD_ENTER, SPACE]) {
      expect(intent(key, 'trip', 'button', { helpOpen: true }), key.code).toBe('none');
      expect(intent(key, 'trip', 'none', { helpOpen: true }), key.code).toBe('block');
    }
    // Tab et Maj+Tab : non interceptés (le piège de focus est dans l'overlay).
    for (const focus of FOCUSES) {
      expect(intent(TAB, 'tuning', focus, { helpOpen: true })).toBe('none');
    }
    // Échap ferme toujours l'aide.
    expect(intent(ESCAPE, 'tuning', 'button', { helpOpen: true })).toBe('closeHelp');
  });

  it('réglage ouvert, aide fermée : Échap referme le panneau sans lancer ni pause', () => {
    for (const focus of FOCUSES) {
      expect(intent(ESCAPE, 'tuning', focus)).toBe('closeTuning');
      expect(intent(ESCAPE, 'tuning', focus, { helpOpen: true })).toBe('closeHelp');
    }
    expect(intent(ESCAPE, 'approach')).toBe('pause');
    expect(intent(ESCAPE, 'trip')).toBe('pause');
  });

  it('aucune touche du jeu ne laisse le défilement natif quand le focus est sur le document', () => {
    for (const key of ALL_KEYS) {
      for (const phase of PHASES) {
        expect(intent(key, phase, 'none'), `${key.code}/${phase}`).not.toBe('none');
      }
    }
  });
});

describe('kpDeltaOf, walkSideOf', () => {
  it('écarts de Kp : ±100 et ±1000, 0 sinon', () => {
    expect(KP_SMALL_STEP).toBe(100);
    expect(KP_BIG_STEP).toBe(1000);
    expect(kpDeltaOf('kpUp')).toBe(100);
    expect(kpDeltaOf('kpDown')).toBe(-100);
    expect(kpDeltaOf('kpUpBig')).toBe(1000);
    expect(kpDeltaOf('kpDownBig')).toBe(-1000);
    for (const other of ['none', 'block', 'launch', 'walkLeft', 'restart'] as const) {
      expect(kpDeltaOf(other)).toBe(0);
    }
  });

  it('côté de marche par position physique', () => {
    expect(walkSideOf('ArrowLeft')).toBe('left');
    expect(walkSideOf('KeyA')).toBe('left');
    expect(walkSideOf('ArrowRight')).toBe('right');
    expect(walkSideOf('KeyD')).toBe('right');
    expect(walkSideOf('KeyQ')).toBeNull();
    expect(walkSideOf('KeyW')).toBeNull();
  });
});

describe("tableau d'école : touche T (T-042)", () => {
  const KEY_T = K('KeyT', 't');
  /** T sur un clavier AZERTY ou autre : seule la position physique compte. */
  const OTHER_LAYOUT_T = K('KeyT', 'ŧ');

  it("ouvre le tableau dans toutes les phases, hors du champ numérique, quel que soit l'autre focus", () => {
    for (const phase of PHASES) {
      for (const focus of FOCUSES.filter((f) => f !== 'number')) {
        expect(intent(KEY_T, phase, focus), `${phase}/${focus}`).toBe('openBoard');
        expect(intent(OTHER_LAYOUT_T, phase, focus), `${phase}/${focus}`).toBe('openBoard');
      }
    }
  });

  it('dans le champ numérique, la frappe reste native : aucune intention', () => {
    for (const phase of PHASES) {
      for (const boardOpen of [false, true]) {
        for (const helpOpen of [false, true]) {
          expect(intent(KEY_T, phase, 'number', { boardOpen, helpOpen })).toBe('none');
        }
      }
    }
  });

  it('une répétition automatique est ignorée (bloquée, rien ne s’ouvre ni ne se ferme)', () => {
    for (const phase of PHASES) {
      for (const boardOpen of [false, true]) {
        expect(intent(KEY_T, phase, 'none', { repeat: true, boardOpen })).toBe('block');
      }
    }
  });

  it('tableau ouvert : T le ferme ; aide ouverte : T ouvre le tableau', () => {
    for (const phase of PHASES) {
      expect(intent(KEY_T, phase, 'button', { boardOpen: true })).toBe('closeBoard');
      expect(intent(KEY_T, phase, 'button', { helpOpen: true })).toBe('openBoard');
    }
  });

  it('Ctrl, Alt ou Meta : raccourci du navigateur intact', () => {
    expect(intent(KEY_T, 'approach', 'none', { ctrlKey: true })).toBe('none');
    expect(intent(KEY_T, 'approach', 'none', { altKey: true })).toBe('none');
    expect(intent(KEY_T, 'approach', 'none', { metaKey: true })).toBe('none');
  });

  it('tableau ouvert : Échap le ferme sans pause, aucune commande du jeu ne passe', () => {
    for (const phase of PHASES) {
      for (const focus of FOCUSES) {
        expect(intent(ESCAPE, phase, focus, { boardOpen: true })).toBe('closeBoard');
      }
      expect(intent(KEY_E, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(KEY_R, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(KEY_D, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(ARROW_LEFT, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(PLUS, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(SPACE, phase, 'none', { boardOpen: true })).toBe('block');
      expect(intent(SPACE, phase, 'button', { boardOpen: true })).toBe('none');
      expect(intent(TAB, phase, 'button', { boardOpen: true })).toBe('none');
    }
  });

  it('tableau ouvert : Échap maintenue est ignorée', () => {
    expect(intent(ESCAPE, 'trip', 'none', { boardOpen: true, repeat: true })).toBe('block');
  });
});

describe('keyToIntent : pupitre de contrôle (T-049)', () => {
  it('E ouvre le pupitre en lecture seule en trajet, à l’issue et en pause ; ailleurs, comme avant', () => {
    expect(intent(KEY_E, 'trip')).toBe('openPupitre');
    expect(intent(KEY_E, 'outcome')).toBe('openPupitre');
    expect(intent(KEY_E, 'paused')).toBe('openPupitre');
    expect(intent(KEY_E, 'approach')).toBe('interact');
    expect(intent(KEY_E, 'tuning')).toBe('launch');
    expect(intent(KEY_E, 'boarding')).toBe('skip');
    expect(intent(KEY_E, 'exit')).toBe('skip');
  });

  it('Entrée et Espace n’ouvrent jamais le pupitre', () => {
    for (const key of [ENTER, SPACE]) {
      for (const phase of PHASES) {
        expect(intent(key, phase)).not.toBe('openPupitre');
      }
    }
  });

  it('pupitre ouvert en lecture seule : E et Échap le ferment, dans toutes les phases', () => {
    for (const phase of PHASES) {
      expect(intent(KEY_E, phase, 'none', { pupitreLecture: true }), phase).toBe('closePupitre');
      expect(intent(ESCAPE, phase, 'none', { pupitreLecture: true }), phase).toBe('closePupitre');
    }
  });

  it('Échap ferme le pupitre avant de mettre en pause, après l’aide et le tableau', () => {
    expect(intent(ESCAPE, 'trip', 'none', { pupitreLecture: true })).toBe('closePupitre');
    expect(intent(ESCAPE, 'trip', 'none', { pupitreLecture: true, helpOpen: true })).toBe(
      'closeHelp',
    );
    expect(intent(ESCAPE, 'trip', 'none', { pupitreLecture: true, boardOpen: true })).toBe(
      'closeBoard',
    );
    expect(intent(ESCAPE, 'trip')).toBe('pause');
  });

  it('répétition automatique : E maintenue n’ouvre ni ne ferme le pupitre', () => {
    expect(intent(KEY_E, 'trip', 'none', { repeat: true })).toBe('block');
    expect(intent(KEY_E, 'trip', 'none', { repeat: true, pupitreLecture: true })).toBe('block');
  });

  it('E tapée dans le champ numérique reste native, pupitre ouvert ou non', () => {
    expect(intent(KEY_E, 'trip', 'number')).toBe('none');
    expect(intent(KEY_E, 'trip', 'number', { pupitreLecture: true })).toBe('none');
  });

  it('aide ou tableau ouvert : E ne fait rien (bloquée), même pupitre ouvert', () => {
    expect(intent(KEY_E, 'trip', 'none', { helpOpen: true, pupitreLecture: true })).toBe('block');
    expect(intent(KEY_E, 'trip', 'none', { boardOpen: true })).toBe('block');
  });

  it('la marche et les touches de réglage ne sont pas touchées par le pupitre ouvert', () => {
    expect(intent(KEY_D, 'approach', 'none', { pupitreLecture: true })).toBe('walkRight');
    expect(intent(PLUS, 'tuning', 'range', { pupitreLecture: true })).toBe('kpUp');
    expect(intent(PAGE_UP, 'tuning', 'range', { pupitreLecture: true })).toBe('kpUpBig');
  });
});
