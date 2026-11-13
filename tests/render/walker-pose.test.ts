import { describe, expect, it } from 'vitest';
import {
  FOREARM_LENGTH,
  NECK_TO_HEAD,
  SHIN_LENGTH,
  STRIDE_LENGTH,
  THIGH_LENGTH,
  TORSO_LENGTH,
  UPPER_ARM_LENGTH,
} from '../../src/render/pencil-style';
import {
  HAT_ANGLE_INDEX,
  straightHipHeight,
  JOINT,
  POSE_SIZE,
  createPoseBuffer,
  poseWalker,
  walkPhase,
  type WalkerPoseKind,
} from '../../src/render/walker-pose';

const KINDS: readonly WalkerPoseKind[] = [
  'stand',
  'walk',
  'reach',
  'cheer',
  'bonk',
  'akimbo',
  'shrug',
];

function dist(p: Float64Array, a: number, b: number): number {
  return Math.hypot(
    (p[2 * a] as number) - (p[2 * b] as number),
    (p[2 * a + 1] as number) - (p[2 * b + 1] as number),
  );
}

const LIMBS: readonly [string, number, number, number][] = [
  ['cuisse avant', JOINT.hip, JOINT.kneeFront, THIGH_LENGTH],
  ['tibia avant', JOINT.kneeFront, JOINT.footFront, SHIN_LENGTH],
  ['cuisse arrière', JOINT.hip, JOINT.kneeBack, THIGH_LENGTH],
  ['tibia arrière', JOINT.kneeBack, JOINT.footBack, SHIN_LENGTH],
  ['bras avant', JOINT.shoulder, JOINT.elbowFront, UPPER_ARM_LENGTH],
  ['avant-bras avant', JOINT.elbowFront, JOINT.handFront, FOREARM_LENGTH],
  ['bras arrière', JOINT.shoulder, JOINT.elbowBack, UPPER_ARM_LENGTH],
  ['avant-bras arrière', JOINT.elbowBack, JOINT.handBack, FOREARM_LENGTH],
  ['buste', JOINT.hip, JOINT.neck, TORSO_LENGTH],
  ['cou', JOINT.neck, JOINT.head, NECK_TO_HEAD],
];

describe('pose du bonhomme', () => {
  const pose = createPoseBuffer();
  it('tableau de pose de la bonne taille', () => {
    expect(pose.length).toBe(POSE_SIZE);
  });
  for (const kind of KINDS) {
    it(`${kind} : longueurs de membres constantes et pieds au sol, toutes phases, deux sens`, () => {
      for (const facing of [-1, 1] as const) {
        for (let distance = -2.2; distance <= 2.2; distance += 0.037) {
          const ground = 0.7;
          poseWalker(pose, kind, 1.5 + distance, ground, facing, distance);
          for (let i = 0; i < POSE_SIZE; i += 1) {
            expect(Number.isFinite(pose[i])).toBe(true);
          }
          for (const [, a, b, length] of LIMBS) {
            expect(dist(pose, a, b)).toBeCloseTo(length, 9);
          }
          const front = pose[2 * JOINT.footFront + 1] as number;
          const back = pose[2 * JOINT.footBack + 1] as number;
          expect(Math.min(front, back)).toBeCloseTo(ground, 9);
          expect(front).toBeGreaterThanOrEqual(ground - 1e-9);
          expect(back).toBeGreaterThanOrEqual(ground - 1e-9);
          // La tête reste au-dessus des pieds.
          expect(pose[2 * JOINT.head + 1] as number).toBeGreaterThan(ground + 0.5);
        }
      }
    });
  }
  it('la marche suit la distance parcourue, pas le temps (période STRIDE_LENGTH)', () => {
    const a = createPoseBuffer();
    const b = createPoseBuffer();
    poseWalker(a, 'walk', 0, 0, 1, 0.3);
    poseWalker(b, 'walk', 0, 0, 1, 0.3 + STRIDE_LENGTH);
    for (let i = 0; i < POSE_SIZE; i += 1) expect(b[i]).toBeCloseTo(a[i] as number, 9);
    poseWalker(b, 'walk', 0, 0, 1, 0.3 + STRIDE_LENGTH / 4);
    expect(b[2 * JOINT.footFront]).not.toBeCloseTo(a[2 * JOINT.footFront] as number, 3);
    expect(walkPhase(STRIDE_LENGTH)).toBeCloseTo(2 * Math.PI, 12);
  });
  it('l’orientation est un miroir autour de l’abscisse des pieds', () => {
    const right = createPoseBuffer();
    const left = createPoseBuffer();
    for (const kind of KINDS) {
      poseWalker(right, kind, 2, 0, 1, 0.4);
      poseWalker(left, kind, 2, 0, -1, 0.4);
      for (let j = 0; j < JOINT.hat; j += 1) {
        expect((left[2 * j] as number) - 2).toBeCloseTo(2 - (right[2 * j] as number), 9);
        expect(left[2 * j + 1]).toBeCloseTo(right[2 * j + 1] as number, 9);
      }
    }
  });
  it('debout : corps vertical, jambes tendues, symétrique, bras le long du corps', () => {
    for (const facing of [-1, 1] as const) {
      poseWalker(pose, 'stand', 3, 0.5, facing, 0.37);
      const x = (j: number): number => pose[2 * j] as number;
      const y = (j: number): number => pose[2 * j + 1] as number;
      expect(x(JOINT.hip)).toBeCloseTo(3, 12);
      expect(x(JOINT.neck)).toBeCloseTo(3, 12);
      expect(x(JOINT.head)).toBeCloseTo(3, 12);
      expect(x(JOINT.shoulder)).toBeCloseTo(3, 12);
      // Jambes tendues : hanche → pied = cuisse + tibia (à 1e-5 près).
      expect(dist(pose, JOINT.hip, JOINT.footFront)).toBeCloseTo(THIGH_LENGTH + SHIN_LENGTH, 5);
      expect(dist(pose, JOINT.hip, JOINT.footBack)).toBeCloseTo(THIGH_LENGTH + SHIN_LENGTH, 5);
      // Symétrie avant / arrière autour de x = 3.
      for (const [a, b] of [
        [JOINT.footFront, JOINT.footBack],
        [JOINT.elbowFront, JOINT.elbowBack],
        [JOINT.handFront, JOINT.handBack],
      ] as const) {
        expect(x(a) - 3).toBeCloseTo(3 - x(b), 9);
        expect(y(a)).toBeCloseTo(y(b), 9);
      }
      // Bras le long du corps : mains à moins de 0,1 m de l'axe, sous la hanche + 0,2 m.
      expect(Math.abs(x(JOINT.handFront) - 3)).toBeLessThan(0.1);
      expect(y(JOINT.handFront)).toBeLessThan(y(JOINT.hip) + 0.2);
      // La pose debout ne dépend pas de la distance parcourue.
      const other = createPoseBuffer();
      poseWalker(other, 'stand', 3, 0.5, facing, 1.91);
      expect(Array.from(other)).toEqual(Array.from(pose));
    }
  });
  it('mains aux hanches : mains près des hanches, coudes écartés de part et d’autre', () => {
    poseWalker(pose, 'akimbo', 0, 0, 1, 0);
    const hipY = pose[2 * JOINT.hip + 1] as number;
    expect(dist(pose, JOINT.handFront, JOINT.hip)).toBeLessThan(0.1);
    expect(dist(pose, JOINT.handBack, JOINT.hip)).toBeLessThan(0.1);
    expect(pose[2 * JOINT.elbowFront] as number).toBeGreaterThan(0.15);
    expect(pose[2 * JOINT.elbowBack] as number).toBeLessThan(-0.15);
    expect(hipY).toBeCloseTo(straightHipHeight(0.14), 12);
  });
  it('victoire : mains au-dessus de la tête ; choc : assis, chapeau au sol', () => {
    poseWalker(pose, 'cheer', 0, 0, 1, 0);
    const head = pose[2 * JOINT.head + 1] as number;
    expect(pose[2 * JOINT.handFront + 1] as number).toBeGreaterThan(head);
    expect(pose[2 * JOINT.handBack + 1] as number).toBeGreaterThan(head);
    poseWalker(pose, 'bonk', 0, 0, 1, 0);
    expect(pose[2 * JOINT.hip + 1] as number).toBeLessThan(0.3);
    expect(pose[2 * JOINT.hat + 1] as number).toBeLessThan(0.1);
    expect(pose[HAT_ANGLE_INDEX]).not.toBe(0);
  });
});
