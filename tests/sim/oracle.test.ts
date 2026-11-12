/**
 * Oracle analytique (spec T-001 §5, tolérances T1–T5) : la simulation de l'ascenseur en
 * régime linéaire (saturation désactivée, Umax = 1e12 N) est comparée aux formules du second
 * ordre, recalculées ici à partir des paramètres physiques (aucune valeur attendue en dur).
 */
import { describe, expect, it } from 'vitest';
import { ELEVATOR_PARAMS, ELEVATOR_SETPOINT, SIM_DT, createElevatorLoop } from '../../src/sim';

const { mass: m, gravity: g, damping: c } = ELEVATOR_PARAMS;
const r = ELEVATOR_SETPOINT;
const Y0 = 0;
/** Saturation « désactivée » de l'oracle (spec §5). */
const NO_SATURATION = 1e12;
/** Horizon de simulation de l'oracle (s). */
const HORIZON = 10;
/** Pas fin de l'oracle (s). */
const FINE_DT = 1 / 1000;
/** Points de pourcentage → fraction. */
const POINT = 0.01;

/** Erreur statique e_ss = m·g/Kp (m). */
const steadyStateError = (kp: number): number => (m * g) / kp;
/** ωn = √(Kp/m) (s⁻¹). */
const naturalFrequency = (kp: number): number => Math.sqrt(kp / m);
/** ζ = c/(2·√(Kp·m)). */
const dampingRatio = (kp: number): number => c / (2 * Math.sqrt(kp * m));
/** Mp = exp(−ζπ/√(1−ζ²)) (fraction, ζ < 1). */
function overshoot(kp: number): number {
  const z = dampingRatio(kp);
  return Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z));
}
/** tp = π/(ωn·√(1−ζ²)) (s). */
function peakTime(kp: number): number {
  const z = dampingRatio(kp);
  return Math.PI / (naturalFrequency(kp) * Math.sqrt(1 - z * z));
}

interface Run {
  /** y(k·dt) pour k = 0..N (m). */
  readonly ys: Float64Array;
  readonly dt: number;
}

/** Simule HORIZON secondes sans saturation et renvoie y après chaque pas (y[0] = y0). */
function simulate(kp: number, dt: number): Run {
  const loop = createElevatorLoop({ kp, dt, maxForce: NO_SATURATION });
  const steps = Math.round(HORIZON / dt);
  const ys = new Float64Array(steps + 1);
  ys[0] = loop.x[0] as number;
  for (let k = 1; k <= steps; k++) {
    const s = loop.step();
    expect(s.saturated).toBe(false);
    ys[k] = s.x[0] as number;
  }
  return { ys, dt };
}

/** Dépassement mesuré relatif à l'amplitude y_ss − y0, y_ss = valeur simulée finale. */
function measuredOvershoot({ ys }: Run): { mp: number; kPeak: number } {
  const yss = ys[ys.length - 1] as number;
  let kPeak = 0;
  for (let k = 1; k < ys.length; k++) if ((ys[k] as number) > (ys[kPeak] as number)) kPeak = k;
  return { mp: ((ys[kPeak] as number) - yss) / (yss - Y0), kPeak };
}

describe('oracle analytique de l’ascenseur (spec §5)', () => {
  it.each([500, 1000, 2500, 4000, 8000])(
    'T1 e_ss à t = 10 s, dt = 1/120, Kp = %i : |e_sim − m·g/Kp| ≤ 1e-6 m',
    (kp) => {
      const run = simulate(kp, SIM_DT);
      const eSim = r - (run.ys[run.ys.length - 1] as number);
      const eAna = steadyStateError(kp);
      const gap = Math.abs(eSim - eAna);
      console.info(
        `T1 Kp=${String(kp)} e_sim=${eSim.toFixed(9)} e_ana=${eAna.toFixed(9)} écart=${gap.toExponential(2)}`,
      );
      expect(gap).toBeLessThanOrEqual(1e-6);
    },
  );

  it.each([1000, 2500, 4000])(
    'T2 Mp, dt = 1/1000, Kp = %i : |Mp_sim − Mp_ana| ≤ 0,5 point',
    (kp) => {
      const run = simulate(kp, FINE_DT);
      const { mp, kPeak } = measuredOvershoot(run);
      const ana = overshoot(kp);
      console.info(
        `T2 Kp=${String(kp)} Mp_sim=${(mp / POINT).toFixed(4)} % Mp_ana=${(ana / POINT).toFixed(4)} % écart=${(Math.abs(mp - ana) / POINT).toFixed(4)} pt ; tp_sim=${(kPeak * run.dt).toFixed(4)} s tp_ana=${peakTime(kp).toFixed(4)} s`,
      );
      expect(Math.abs(mp - ana)).toBeLessThanOrEqual(0.5 * POINT);
    },
  );

  it.each([1000, 2500, 4000])(
    'T3 Mp, dt = 1/120, Kp = %i : Mp_ana ≤ Mp_sim ≤ Mp_ana + 2,5 points',
    (kp) => {
      const run = simulate(kp, SIM_DT);
      const { mp, kPeak } = measuredOvershoot(run);
      const ana = overshoot(kp);
      console.info(
        `T3 Kp=${String(kp)} Mp_sim=${(mp / POINT).toFixed(4)} % Mp_ana=${(ana / POINT).toFixed(4)} % écart=${((mp - ana) / POINT).toFixed(4)} pt ; tp_sim=${(kPeak * run.dt).toFixed(4)} s`,
      );
      expect(mp).toBeGreaterThanOrEqual(ana);
      expect(mp).toBeLessThanOrEqual(ana + 2.5 * POINT);
    },
  );

  it('T4 tp, dt = 1/1000, Kp = 2500 : |tp_sim − tp_ana| ≤ 0,01 s', () => {
    const kp = 2500;
    const run = simulate(kp, FINE_DT);
    const tpSim = measuredOvershoot(run).kPeak * run.dt;
    const tpAna = peakTime(kp);
    console.info(
      `T4 Kp=2500 tp_sim=${tpSim.toFixed(4)} s tp_ana=${tpAna.toFixed(4)} s écart=${Math.abs(tpSim - tpAna).toFixed(4)} s`,
    );
    expect(Math.abs(tpSim - tpAna)).toBeLessThanOrEqual(0.01);
  });

  it('T5 Kp = 150 < m·g/r : la cabine reste au sol (y = 0, ẏ = 0) pendant 10 s', () => {
    const kp = 150;
    expect(kp * r).toBeLessThan(m * g); // sous le seuil de décollage Kp·r > m·g
    const loop = createElevatorLoop({ kp, maxForce: NO_SATURATION });
    const steps = Math.round(HORIZON / SIM_DT);
    let yMax = 0;
    for (let k = 0; k < steps; k++) {
      const s = loop.step();
      yMax = Math.max(yMax, s.x[0] as number);
      expect(s.x[0]).toBe(0);
      expect(s.x[1]).toBe(0);
    }
    console.info(`T5 Kp=150 seuil=${((m * g) / r).toFixed(2)} N/m y_max=${String(yMax)}`);
  });
});

/**
 * Taux de décroissance de l'enveloppe mesuré par moindres carrés : z(t) = y(t) − y_ss vaut
 * A·e^{−σt}·cos(ωd·t + φ) ; aux extrémums locaux de |z| (un par demi-période),
 * ln|z| = ln A' − σ·t. On ajuste une droite ln|z_n| = a − σ·t_n sur tous les extrémums
 * d'amplitude ≥ AMPLITUDE_FLOOR (au-dessous, l'arrondi flottant domine) et on renvoie σ.
 * y_ss = valeur simulée finale (aucune valeur analytique injectée).
 */
function envelopeDecayRate({ ys, dt }: Run): { sigma: number; extrema: number } {
  const AMPLITUDE_FLOOR = 1e-9;
  const yss = ys[ys.length - 1] as number;
  let n = 0;
  let sumT = 0;
  let sumL = 0;
  let sumTT = 0;
  let sumTL = 0;
  for (let k = 1; k < ys.length - 1; k++) {
    const a = Math.abs((ys[k] as number) - yss);
    const before = Math.abs((ys[k - 1] as number) - yss);
    const after = Math.abs((ys[k + 1] as number) - yss);
    if (a >= before && a > after && a >= AMPLITUDE_FLOOR) {
      const t = k * dt;
      const l = Math.log(a);
      n++;
      sumT += t;
      sumL += l;
      sumTT += t * t;
      sumTL += t * l;
    }
  }
  const slope = (n * sumTL - sumT * sumL) / (n * sumTT - sumT * sumT);
  return { sigma: -slope, extrema: n };
}

/**
 * Domaine de validité (défaut D-4 de T-005) : ζ·ωn = c/(2m) est exact en CONTINU. La boucle
 * échantillonnée (bloqueur d'ordre zéro) a un taux de décroissance σ = −ln ρ / dt qui baisse
 * avec Kp : à dt = 1/120, l'écart à c/(2m) vaut −1,1 % à Kp = 1000, −4,3 % à 4000 et −8,5 % à
 * 8000. La tolérance de 5 % ci-dessous ne vaut donc que pour Kp ≤ 4000 à dt = 1/120 : ne pas
 * étendre ces cas à Kp = 8000 sans changer de référence (voir le test suivant, qui compare à
 * la valeur exacte de la boucle échantillonnée).
 */
describe('propriété : Kp n’accélère pas la stabilisation (ζ·ωn = c/(2m))', () => {
  const sigmaAna = c / (2 * m);
  const cases = [1000, 2500, 4000].flatMap((kp) => [
    { kp, dt: SIM_DT, label: '1/120' },
    { kp, dt: FINE_DT, label: '1/1000' },
  ]);
  it.each(cases)(
    'Kp = $kp, dt = $label : taux de décroissance de l’enveloppe = c/(2m) à 5 % près',
    ({ kp, dt, label }) => {
      // Contrôle du régime : sous-amorti (ζ < 1), aucun contact sol après décollage.
      expect(dampingRatio(kp)).toBeLessThan(1);
      const run = simulate(kp, dt);
      for (let k = 1; k < run.ys.length; k++) expect(run.ys[k]).toBeGreaterThan(0);
      const { sigma, extrema } = envelopeDecayRate(run);
      const relative = Math.abs(sigma - sigmaAna) / sigmaAna;
      console.info(
        `CA-5 Kp=${String(kp)} dt=${label} σ_sim=${sigma.toFixed(5)} s⁻¹ σ_ana=${sigmaAna.toFixed(5)} s⁻¹ ` +
          `écart=${(relative * 100).toFixed(2)} % extrémums=${String(extrema)}`,
      );
      expect(extrema).toBeGreaterThanOrEqual(3);
      expect(relative).toBeLessThanOrEqual(0.05);
    },
  );
});

/**
 * Taux de décroissance EXACT de la boucle échantillonnée sans saturation (pas h) : rayon
 * spectral ρ de A_cl = Φ − Γ·Kp·[1 0], avec Φ, Γ du bloqueur d'ordre zéro en forme fermée
 * (a = c/m, u₁ = 1 − e^{−a·h}) : Φ = [1 u₁/a ; 0 1 − u₁], Γ = [(a·h − u₁)/a² ; u₁/a]/m.
 * Valeurs propres complexes conjuguées (régime oscillant) ⇒ ρ = √det(A_cl) ; σ = −ln ρ / h.
 */
function exactSampledDecayRate(kp: number, h: number): { sigma: number; discriminant: number } {
  const a = c / m;
  const u1 = -Math.expm1(-a * h);
  const phi01 = u1 / a;
  const phi11 = 1 - u1;
  const gam0 = (a * h - u1) / (a * a * m);
  const gam1 = u1 / (a * m);
  const a00 = 1 - gam0 * kp;
  const a01 = phi01;
  const a10 = -gam1 * kp;
  const a11 = phi11;
  const trace = a00 + a11;
  const det = a00 * a11 - a01 * a10;
  const discriminant = (trace * trace) / 4 - det;
  return { sigma: -Math.log(Math.sqrt(det)) / h, discriminant };
}

describe('D-4 : taux de décroissance à Kp = 8000 (hors domaine de la propriété continue)', () => {
  it('Kp = 8000, dt = 1/120 : σ mesuré = σ exact de la boucle échantillonnée à 1 % près', () => {
    const kp = 8000;
    const { sigma: sigmaExact, discriminant } = exactSampledDecayRate(kp, SIM_DT);
    expect(discriminant).toBeLessThan(0); // valeurs propres complexes : ρ = √det
    const run = simulate(kp, SIM_DT);
    const { sigma, extrema } = envelopeDecayRate(run);
    const sigmaContinuous = c / (2 * m);
    const relative = Math.abs(sigma - sigmaExact) / sigmaExact;
    console.info(
      `D-4 Kp=8000 dt=1/120 σ_sim=${sigma.toFixed(5)} s⁻¹ σ_exact_échantillonné=${sigmaExact.toFixed(5)} s⁻¹ ` +
        `écart=${(relative * 100).toFixed(3)} % ; c/(2m)=${sigmaContinuous.toFixed(5)} s⁻¹ ` +
        `(écart ${(((sigmaExact - sigmaContinuous) / sigmaContinuous) * 100).toFixed(2)} %) extrémums=${String(extrema)}`,
    );
    expect(extrema).toBeGreaterThanOrEqual(3);
    expect(relative).toBeLessThanOrEqual(0.01);
    // Documente D-4 : à 8000, l'écart à c/(2m) sort de la tolérance de 5 % du test continu.
    expect(Math.abs(sigmaExact - sigmaContinuous) / sigmaContinuous).toBeGreaterThan(0.05);
  });
});
