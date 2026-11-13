/**
 * Pose du bonhomme bâton (T-009) : positions des articulations pour chaque attitude. Fonction
 * pure, sans three ni allocation : écrit dans un tableau fourni.
 *
 * Construction : jambes en cinématique inverse (hanche et pied imposés, genou calculé, cuisse et
 * tibia de longueur constante), buste en cinématique directe, bras en cinématique directe
 * (angles) ou inverse (mains aux hanches). Les longueurs de membres sont donc les mêmes dans
 * toutes les poses. Debout, la hanche est à {@link HIP_HEIGHT} ou à la hauteur qui tend les
 * jambes pour l'écart de pieds de la pose : jambes droites, buste vertical. La marche est réglée sur la DISTANCE
 * parcourue (un cycle de deux pas par {@link STRIDE_LENGTH}), pas sur le temps : à l'arrêt, les
 * jambes ne bougent pas ; le pied d'appui est toujours au sol.
 */
import type { Facing } from '../game';
import {
  ARM_SWING,
  FOREARM_LENGTH,
  HAT_DOME_RADIUS,
  HEAD_RADIUS,
  HIP_BOB,
  HIP_HEIGHT,
  HIP_HEIGHT_SITTING,
  HIP_HEIGHT_WALK,
  NECK_TO_HEAD,
  NECK_TO_SHOULDER,
  SHIN_LENGTH,
  STANCE_HALF,
  STANCE_HALF_WIDE,
  STEP_LIFT,
  STEP_REACH,
  STRIDE_LENGTH,
  THIGH_LENGTH,
  TORSO_LENGTH,
  UPPER_ARM_LENGTH,
} from './pencil-style';

/**
 * Attitudes du bonhomme :
 * - `stand` debout ; `walk` marche ; `reach` main sur le levier de la console ;
 * - `cheer` victoire (bras levés) ; `bonk` choc (assis, chapeau tombé) ;
 * - `akimbo` marche trop haute (mains sur les hanches, perplexe) ; `shrug` pas de décollage
 *   (haussement d'épaules).
 */
export type WalkerPoseKind = 'stand' | 'walk' | 'reach' | 'cheer' | 'bonk' | 'akimbo' | 'shrug';

/** Indices des articulations (point i aux valeurs 2i, 2i + 1 du tableau de pose). */
export const JOINT = Object.freeze({
  head: 0,
  neck: 1,
  shoulder: 2,
  hip: 3,
  elbowFront: 4,
  handFront: 5,
  elbowBack: 6,
  handBack: 7,
  kneeFront: 8,
  footFront: 9,
  kneeBack: 10,
  footBack: 11,
  /** Centre du bord du chapeau. */
  hat: 12,
});
/** Nombre d'articulations. */
export const JOINT_COUNT = 13;
/** Indice de l'angle du chapeau (rad, sens trigonométrique) dans le tableau de pose. */
export const HAT_ANGLE_INDEX = JOINT_COUNT * 2;
/** Taille du tableau de pose. */
export const POSE_SIZE = JOINT_COUNT * 2 + 1;

/** Crée un tableau de pose (à allouer une fois). */
export function createPoseBuffer(): Float64Array {
  return new Float64Array(POSE_SIZE);
}

/**
 * Phase de marche (rad) pour une distance parcourue.
 * @param distance distance parcourue (m), ou simplement l'abscisse.
 */
export function walkPhase(distance: number): number {
  return (2 * Math.PI * distance) / STRIDE_LENGTH;
}

/** Mains aux hanches : écart horizontal des mains par rapport à la hanche (m). */
const AKIMBO_HAND_OFFSET = 0.06;
/** Mains aux hanches : hauteur des mains au-dessus de la hanche (m). */
const AKIMBO_HAND_RISE = 0.04;

function setJoint(out: Float64Array, joint: number, x: number, y: number): void {
  out[2 * joint] = x;
  out[2 * joint + 1] = y;
}

/**
 * Hauteur de hanche qui tend les jambes pour des pieds écartés de ±`stanceHalf` (m).
 * @param stanceHalf demi-écart des pieds (m).
 */
export function straightHipHeight(stanceHalf: number): number {
  return Math.sqrt((THIGH_LENGTH + SHIN_LENGTH) ** 2 - stanceHalf ** 2) - 1e-6;
}

/**
 * Chaîne à deux segments par cinématique inverse : de la racine (ax, ay) vers la cible (tx, ty),
 * segments `first` puis `second` ; la cible est ramenée à portée si besoin. L'articulation du
 * milieu plie du côté de (bendX, bendY).
 */
function twoBone(
  out: Float64Array,
  middle: number,
  end: number,
  ax: number,
  ay: number,
  tx: number,
  ty: number,
  first: number,
  second: number,
  bendX: number,
  bendY: number,
): void {
  let dx = tx - ax;
  let dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const reach = first + second - 1e-9;
  if (d > reach) {
    dx *= reach / d;
    dy *= reach / d;
    d = reach;
  }
  if (d < 1e-9) {
    dx = 0;
    dy = -1e-9;
    d = 1e-9;
  }
  const ux = dx / d;
  const uy = dy / d;
  // Loi des cosinus : projection du milieu sur l'axe racine → cible, puis hauteur.
  const along = (first * first - second * second + d * d) / (2 * d);
  const side = Math.sqrt(Math.max(0, first * first - along * along));
  let px = -uy;
  let py = ux;
  if (px * bendX + py * bendY < 0) {
    px = -px;
    py = -py;
  }
  setJoint(out, middle, ax + ux * along + px * side, ay + uy * along + py * side);
  setJoint(out, end, ax + dx, ay + dy);
}

/** Bras par cinématique directe : angles depuis la verticale basse, positifs vers l'avant. */
function arm(
  out: Float64Array,
  elbow: number,
  hand: number,
  shoulderX: number,
  shoulderY: number,
  upper: number,
  lower: number,
  facing: Facing,
): void {
  const ex = shoulderX + UPPER_ARM_LENGTH * Math.sin(upper) * facing;
  const ey = shoulderY - UPPER_ARM_LENGTH * Math.cos(upper);
  setJoint(out, elbow, ex, ey);
  setJoint(
    out,
    hand,
    ex + FOREARM_LENGTH * Math.sin(lower) * facing,
    ey - FOREARM_LENGTH * Math.cos(lower),
  );
}

/**
 * Calcule une pose.
 * @param out tableau de pose ({@link createPoseBuffer}).
 * @param kind attitude.
 * @param x abscisse des pieds (m).
 * @param ground hauteur du sol sous les pieds (m).
 * @param facing orientation (−1 gauche, +1 droite).
 * @param distance distance parcourue (m), pour la phase de marche (`walk` seulement).
 */
export function poseWalker(
  out: Float64Array,
  kind: WalkerPoseKind,
  x: number,
  ground: number,
  facing: Facing,
  distance: number,
): void {
  let hipHeight = HIP_HEIGHT;
  let akimbo = false;
  let frontDx = STANCE_HALF;
  let backDx = -STANCE_HALF;
  let frontLift = 0;
  let backLift = 0;
  let lean = 0;
  let headTilt = 0;
  // Debout : bras le long du corps, à peine écartés, symétriques.
  let frontUpper = 0.08;
  let frontLower = 0.04;
  let backUpper = -0.08;
  let backLower = -0.04;
  let hatOnHead = true;
  switch (kind) {
    case 'walk': {
      const phase = walkPhase(distance);
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      frontDx = STEP_REACH * s;
      backDx = -STEP_REACH * s;
      frontLift = STEP_LIFT * Math.max(0, c);
      backLift = STEP_LIFT * Math.max(0, -c);
      hipHeight = HIP_HEIGHT_WALK - HIP_BOB * Math.abs(s);
      lean = 0.06;
      frontUpper = -ARM_SWING * s;
      frontLower = frontUpper + 0.3;
      backUpper = ARM_SWING * s;
      backLower = backUpper + 0.3;
      break;
    }
    case 'reach':
      frontUpper = 1.15;
      frontLower = 1.5;
      break;
    case 'cheer':
      frontDx = STANCE_HALF_WIDE;
      backDx = -STANCE_HALF_WIDE;
      hipHeight = straightHipHeight(STANCE_HALF_WIDE);
      frontUpper = 2.55;
      frontLower = 2.85;
      backUpper = -2.55;
      backLower = -2.85;
      headTilt = -0.1;
      break;
    case 'akimbo':
      frontDx = STANCE_HALF_WIDE;
      backDx = -STANCE_HALF_WIDE;
      hipHeight = straightHipHeight(STANCE_HALF_WIDE);
      headTilt = 0.22;
      akimbo = true;
      break;
    case 'shrug':
      frontDx = STANCE_HALF_WIDE;
      backDx = -STANCE_HALF_WIDE;
      hipHeight = straightHipHeight(STANCE_HALF_WIDE);
      frontUpper = 1.05;
      frontLower = 2.75;
      backUpper = -1.05;
      backLower = -2.75;
      headTilt = -0.12;
      break;
    case 'bonk':
      hipHeight = HIP_HEIGHT_SITTING;
      frontDx = 0.62;
      backDx = 0.5;
      lean = -0.35;
      headTilt = 0.25;
      frontUpper = -0.65;
      frontLower = -0.95;
      backUpper = -0.45;
      backLower = -0.75;
      hatOnHead = false;
      break;
    case 'stand':
      break;
  }
  const hipX = x;
  const hipY = ground + hipHeight;
  setJoint(out, JOINT.hip, hipX, hipY);
  const tx = Math.sin(lean) * facing;
  const ty = Math.cos(lean);
  const neckX = hipX + TORSO_LENGTH * tx;
  const neckY = hipY + TORSO_LENGTH * ty;
  setJoint(out, JOINT.neck, neckX, neckY);
  const hx = Math.sin(lean + headTilt) * facing;
  const hy = Math.cos(lean + headTilt);
  const headX = neckX + NECK_TO_HEAD * hx;
  const headY = neckY + NECK_TO_HEAD * hy;
  setJoint(out, JOINT.head, headX, headY);
  const shoulderX = neckX - NECK_TO_SHOULDER * tx;
  const shoulderY = neckY - NECK_TO_SHOULDER * ty;
  setJoint(out, JOINT.shoulder, shoulderX, shoulderY);
  if (akimbo) {
    // Mains posées sur les hanches, coudes écartés vers l'avant et vers l'arrière.
    const handY = hipY + AKIMBO_HAND_RISE;
    twoBone(
      out,
      JOINT.elbowFront,
      JOINT.handFront,
      shoulderX,
      shoulderY,
      hipX + AKIMBO_HAND_OFFSET * facing,
      handY,
      UPPER_ARM_LENGTH,
      FOREARM_LENGTH,
      facing,
      0,
    );
    twoBone(
      out,
      JOINT.elbowBack,
      JOINT.handBack,
      shoulderX,
      shoulderY,
      hipX - AKIMBO_HAND_OFFSET * facing,
      handY,
      UPPER_ARM_LENGTH,
      FOREARM_LENGTH,
      -facing,
      0,
    );
  } else {
    arm(
      out,
      JOINT.elbowFront,
      JOINT.handFront,
      shoulderX,
      shoulderY,
      frontUpper,
      frontLower,
      facing,
    );
    arm(out, JOINT.elbowBack, JOINT.handBack, shoulderX, shoulderY, backUpper, backLower, facing);
  }
  // Genoux : pliés vers l'avant et vers le haut (presque tendus debout).
  twoBone(
    out,
    JOINT.kneeFront,
    JOINT.footFront,
    hipX,
    hipY,
    x + frontDx * facing,
    ground + frontLift,
    THIGH_LENGTH,
    SHIN_LENGTH,
    facing,
    1,
  );
  twoBone(
    out,
    JOINT.kneeBack,
    JOINT.footBack,
    hipX,
    hipY,
    x + backDx * facing,
    ground + backLift,
    THIGH_LENGTH,
    SHIN_LENGTH,
    facing,
    1,
  );
  if (hatOnHead) {
    const lift = HEAD_RADIUS * 0.72;
    setJoint(out, JOINT.hat, headX + lift * hx, headY + lift * hy);
    out[HAT_ANGLE_INDEX] = -(lean + headTilt) * facing;
  } else {
    // Le chapeau a roulé derrière le bonhomme, posé de travers.
    setJoint(out, JOINT.hat, x - 0.5 * facing, ground + HAT_DOME_RADIUS * 0.3);
    out[HAT_ANGLE_INDEX] = 0.45 * facing;
  }
}
