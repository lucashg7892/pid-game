/**
 * Garde des trajets de référence (T-041) : les trois trajets de `src/proto/common/trajets.ts`
 * égalent bit à bit une nouvelle simulation du vrai jeu, leurs signaux sont cohérents, et le
 * lecteur `replay.ts` rend les bons échantillons.
 */
import { describe, expect, it } from 'vitest';
import {
  BEAM_HEIGHT,
  LEVEL1_SETPOINT,
  LEVEL2_ARRIVAL_TOLERANCE,
  LEVEL2_KP,
  SETTLE_SPEED_TOLERANCE,
  STEP_TOLERANCE,
} from '../../src/game';
import { trajetDepuisColonnes } from '../../src/proto/common/colonnes';
import { creerLecteur } from '../../src/proto/common/replay';
import {
  TRAJETS_REFERENCE,
  TRAJET_CHOC,
  TRAJET_SATURATION,
  TRAJET_VICTOIRE,
} from '../../src/proto/common/trajets';
import type { ColonnesTrajet, TrajetReference } from '../../src/proto/common/types';
import { ELEVATOR_MAX_FORCE, ELEVATOR_PARAMS, SIM_DT, elevatorAcceleration } from '../../src/sim';
import { ECHANTILLONS_APRES_ISSUE, REGLAGES, simulerTrajet } from './simuler';

const COLONNES = ['y', 'v', 'a', 'e', 'uCmd', 'uSat', 'p', 'i'] as const;

/** Nombre de pas saturés avant l'issue. */
function pasSatures(t: TrajetReference): number {
  return t.echantillons.slice(0, t.pasIssue).filter((x) => x.saturated).length;
}

describe('trajets enregistrés = nouvelle simulation du jeu, bit à bit', () => {
  it('trois trajets, dans l’ordre victoire, choc, saturation', () => {
    expect(TRAJETS_REFERENCE.map((t) => t.id)).toEqual(['victoire', 'choc', 'saturation']);
    expect(TRAJETS_REFERENCE).toEqual([TRAJET_VICTOIRE, TRAJET_CHOC, TRAJET_SATURATION]);
  });

  it.each(REGLAGES.map((r, j) => [r.id, r, j] as const))('%s', (_id, reglage, j) => {
    const enregistre = TRAJETS_REFERENCE[j] as TrajetReference;
    const { meta, colonnes } = simulerTrajet(reglage);
    expect(enregistre.echantillons).toHaveLength(colonnes.y.length);
    const { echantillons, ...metaEnregistree } = enregistre;
    expect(metaEnregistree).toStrictEqual(meta);
    expect(Object.is(enregistre.yFinal, meta.yFinal)).toBe(true);
    expect(Object.is(enregistre.vFinal, meta.vFinal)).toBe(true);
    expect(Object.is(enregistre.erreurFinale, meta.erreurFinale)).toBe(true);
    echantillons.forEach((x, k) => {
      for (const c of COLONNES) {
        if (!Object.is(x[c], colonnes[c][k])) {
          throw new Error(`${reglage.id}, échantillon ${String(k)}, ${c} : ${String(x[c])}`);
        }
      }
      expect(x.saturated).toBe(colonnes.saturated[k] === 1);
      expect(x.t).toBe(k * SIM_DT);
    });
  });

  it('constantes physiques et règles : celles du jeu', () => {
    for (const t of TRAJETS_REFERENCE) {
      expect(t.dt).toBe(SIM_DT);
      expect(t.physique).toEqual({
        m: ELEVATOR_PARAMS.mass,
        g: ELEVATOR_PARAMS.gravity,
        c: ELEVATOR_PARAMS.damping,
        uMax: ELEVATOR_MAX_FORCE,
        r: LEVEL1_SETPOINT,
        hauteurPoutre: BEAM_HEIGHT,
        toleranceArrivee: t.niveau === 'level2' ? LEVEL2_ARRIVAL_TOLERANCE : STEP_TOLERANCE,
        toleranceVitesse: SETTLE_SPEED_TOLERANCE,
      });
    }
  });
});

describe('réglages et issues des trois trajets', () => {
  it('victoire : niveau 2, Kp = 2500, Ki = 500, issue win', () => {
    const t = TRAJET_VICTOIRE;
    expect([t.niveau, t.kp, t.ki, t.issue]).toEqual(['level2', LEVEL2_KP, 500, 'win']);
    // Saturation au départ, puis terme I qui monte.
    expect(t.echantillons[0]?.saturated).toBe(true);
    const i = t.echantillons.map((x) => x.i);
    expect(i[0]).toBe(0);
    expect(Math.max(...i)).toBeGreaterThan(300);
    expect(i[t.pasIssue - 1]).toBeGreaterThan(i[30] as number);
    expect(Math.abs(t.erreurFinale)).toBeLessThanOrEqual(LEVEL2_ARRIVAL_TOLERANCE);
  });

  it('choc : niveau 2, Ki = 2000, issue bonk, cabine au-dessus de la poutre', () => {
    const t = TRAJET_CHOC;
    expect([t.niveau, t.kp, t.ki, t.issue]).toEqual(['level2', LEVEL2_KP, 2000, 'bonk']);
    expect(t.yFinal).toBeGreaterThan(BEAM_HEIGHT);
  });

  it('saturation : niveau 1, Kp = 5000, issue win, saturation plus longue que la victoire', () => {
    const t = TRAJET_SATURATION;
    expect([t.niveau, t.kp, t.ki, t.issue]).toEqual(['level1', 5000, 0, 'win']);
    const picCmd = Math.max(...t.echantillons.map((x) => x.uCmd));
    expect(picCmd).toBe(5000 * LEVEL1_SETPOINT);
    expect(picCmd).toBeGreaterThanOrEqual(3 * ELEVATOR_MAX_FORCE);
    // Saturation plus longue que celle de la victoire (35 pas contre 24, mesuré T-041b).
    expect(pasSatures(t)).toBeGreaterThanOrEqual(1.4 * pasSatures(TRAJET_VICTOIRE));
    expect(pasSatures(t)).toBeGreaterThan(pasSatures(TRAJET_CHOC));
    expect(Math.abs(t.erreurFinale)).toBeLessThanOrEqual(STEP_TOLERANCE);
  });
});

describe('cohérence des signaux enregistrés', () => {
  it.each(TRAJETS_REFERENCE.map((t) => [t.id, t] as const))('%s', (_id, t) => {
    const { m, g, c, uMax, r } = t.physique;
    const n = t.echantillons.length;
    expect(n).toBe(t.pasIssue + ECHANTILLONS_APRES_ISSUE);
    t.echantillons.forEach((x, k) => {
      expect(x.uCmd).toBe(x.p + x.i);
      expect(x.uSat).toBe(Math.min(Math.max(x.uCmd, -uMax), uMax));
      expect(x.saturated).toBe(x.uSat !== x.uCmd);
      expect(x.e).toBe(r - x.y);
      const net = x.uSat - m * g - c * x.v;
      expect(x.a).toBe(x.y <= 0 && x.v <= 0 && net < 0 ? 0 : net / m);
      expect(x.a).toBe(elevatorAcceleration(x.y, x.v, x.uSat));
      expect(x.p).toBe(t.kp * x.e);
      if (k > 0 && k < t.pasIssue) {
        // Intégrale du contrôleur PI : I(k) = I(k − 1) + Ki·dt·e(k − 1) (0 au niveau 1).
        const prev = t.echantillons[k - 1] as (typeof t.echantillons)[number];
        expect(x.i).toBe(t.niveau === 'level2' ? prev.i + t.ki * t.dt * prev.e : 0);
      }
    });
    // Après l'issue, le jeu est figé : les échantillons répètent le dernier pas simulé.
    const dernier = t.echantillons[t.pasIssue - 1];
    for (let k = t.pasIssue; k < n; k++) {
      const x = t.echantillons[k];
      expect({ ...x, t: 0 }).toEqual({ ...dernier, t: 0 });
    }
  });
});

describe('lecteur de trajet (replay.ts)', () => {
  const t = TRAJET_VICTOIRE;
  const n = t.echantillons.length;

  it('durée, période, indices et échantillon le plus proche aux instants j·dt', () => {
    const lecteur = creerLecteur(t);
    expect(lecteur.nombre).toBe(n);
    expect(lecteur.duree).toBe((n - 1) * SIM_DT);
    expect(lecteur.periode).toBe(n * SIM_DT);
    expect(lecteur.boucle).toBe(false);
    for (let j = 0; j < n; j++) {
      expect(lecteur.indice(j * SIM_DT)).toBe(j);
      expect(lecteur.plusProche(j * SIM_DT)).toBe(t.echantillons[j]);
      expect(lecteur.indice((j + 0.4) * SIM_DT)).toBe(j);
      expect(lecteur.plusProche((j + 0.4) * SIM_DT)).toBe(t.echantillons[j]);
    }
    expect(lecteur.plusProche(5.6 * SIM_DT)).toBe(t.echantillons[6]);
  });

  it('états idle / playing / finished et bornes du temps', () => {
    const lecteur = creerLecteur(t);
    expect(lecteur.etat(-0.1)).toBe('idle');
    expect(lecteur.etat(Number.NaN)).toBe('idle');
    expect(lecteur.etat(0)).toBe('playing');
    expect(lecteur.etat(lecteur.duree)).toBe('playing');
    expect(lecteur.etat(lecteur.duree + 1e-6)).toBe('finished');
    expect(lecteur.etat(Infinity)).toBe('finished');
    expect(lecteur.plusProche(-3)).toBe(t.echantillons[0]);
    expect(lecteur.plusProche(Number.NaN)).toBe(t.echantillons[0]);
    expect(lecteur.plusProche(1e9)).toBe(t.echantillons[n - 1]);
    expect(lecteur.indice(Infinity)).toBe(n - 1);
    expect(lecteur.tempsTrajet(1e9)).toBe(lecteur.duree);
  });

  it('interpolation linéaire, objet unique réutilisé', () => {
    const lecteur = creerLecteur(t);
    const a = lecteur.interpole(0);
    expect(lecteur.interpole(SIM_DT * 10)).toBe(a);
    for (const j of [0, 1, 10, 57, 200, n - 2]) {
      const x0 = t.echantillons[j] as (typeof t.echantillons)[number];
      const x1 = t.echantillons[j + 1] as (typeof t.echantillons)[number];
      const mid = lecteur.interpole((j + 0.5) * SIM_DT);
      expect(mid.t).toBeCloseTo((j + 0.5) * SIM_DT, 12);
      for (const c of COLONNES) expect(mid[c]).toBeCloseTo((x0[c] + x1[c]) / 2, 9);
      expect(mid.saturated).toBe(x0.saturated);
      const exact = lecteur.interpole(j * SIM_DT);
      for (const c of COLONNES) expect(exact[c]).toBeCloseTo(x0[c], 8);
    }
    const fin = lecteur.interpole(1e9);
    for (const c of COLONNES) expect(fin[c]).toBe(t.echantillons[n - 1]?.[c]);
  });

  it('cabine à afficher : échantillon avant l’issue, yFinal/vFinal à partir de pasIssue', () => {
    for (const traj of TRAJETS_REFERENCE) {
      const lecteur = creerLecteur(traj);
      const k = traj.pasIssue;
      const avant = lecteur.cabine((k - 1) * SIM_DT);
      expect(avant).toEqual({ y: traj.echantillons[k - 1]?.y, v: traj.echantillons[k - 1]?.v });
      expect(lecteur.cabine(0)).toEqual({ y: 0, v: traj.echantillons[0]?.v });
      const a = lecteur.cabine(k * SIM_DT);
      expect(a).toBe(avant); // objet unique réutilisé
      expect(a).toEqual({ y: traj.yFinal, v: traj.vFinal });
      expect(lecteur.cabine((k + 50) * SIM_DT)).toEqual({ y: traj.yFinal, v: traj.vFinal });
      expect(lecteur.cabine(1e9)).toEqual({ y: traj.yFinal, v: traj.vFinal });
      const boucle = creerLecteur(traj, { boucle: true });
      expect(boucle.cabine(boucle.periode + (k + 2) * SIM_DT)).toEqual({
        y: traj.yFinal,
        v: traj.vFinal,
      });
      expect(boucle.cabine(boucle.periode + 2 * SIM_DT).y).toBe(traj.echantillons[2]?.y);
    }
    expect(TRAJET_VICTOIRE.issue).toBe('win');
    expect(Math.abs(TRAJET_VICTOIRE.erreurFinale)).toBeLessThanOrEqual(LEVEL2_ARRIVAL_TOLERANCE);
    expect(TRAJET_SATURATION.yFinal).toBeCloseTo(
      LEVEL1_SETPOINT - TRAJET_SATURATION.erreurFinale,
      12,
    );
  });

  it('cabine à afficher au choc : figée au-dessus de la poutre (pas 29 mm plus bas)', () => {
    const lecteur = creerLecteur(TRAJET_CHOC);
    const fin = lecteur.cabine(lecteur.duree);
    expect(fin.y).toBeGreaterThan(BEAM_HEIGHT);
    expect(fin.y).toBe(TRAJET_CHOC.yFinal);
    const dernier = TRAJET_CHOC.echantillons[TRAJET_CHOC.pasIssue - 1];
    expect(dernier?.y).toBeLessThanOrEqual(BEAM_HEIGHT);
  });

  it('lecture en boucle : toujours playing, temps ramené modulo la période', () => {
    const lecteur = creerLecteur(t, { boucle: true });
    expect(lecteur.boucle).toBe(true);
    expect(lecteur.etat(-1)).toBe('idle');
    expect(lecteur.etat(1e6)).toBe('playing');
    for (const j of [0, 1, 100, n - 1]) {
      expect(lecteur.indice(lecteur.periode + j * SIM_DT)).toBe(j);
      expect(lecteur.indice(3 * lecteur.periode + (j + 0.5) * SIM_DT)).toBe(j);
    }
    expect(lecteur.plusProche(lecteur.periode - 0.1 * SIM_DT)).toBe(t.echantillons[n - 1]);
    expect(lecteur.tempsTrajet(Infinity)).toBe(lecteur.duree);
    expect(lecteur.tempsTrajet(lecteur.periode * 2)).toBeCloseTo(0, 9);
  });

  it('refuse un trajet vide ou un dt invalide ; colonnes de longueurs différentes refusées', () => {
    expect(() => creerLecteur({ ...t, echantillons: [] })).toThrow(RangeError);
    expect(() => creerLecteur({ ...t, dt: 0 })).toThrow(RangeError);
    const colonnes: ColonnesTrajet = {
      y: [0, 1],
      v: [0],
      a: [0],
      e: [0],
      uCmd: [0],
      uSat: [0],
      p: [0],
      i: [0],
      saturated: [0],
    };
    expect(() => trajetDepuisColonnes(t, colonnes)).toThrow(RangeError);
    expect(() => trajetDepuisColonnes(t, { ...colonnes, y: [] })).toThrow(RangeError);
  });

  it('données gelées : un trajet ne se modifie pas par mégarde', () => {
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.echantillons)).toBe(true);
    expect(Object.isFrozen(t.echantillons[0])).toBe(true);
    expect(Object.isFrozen(t.physique)).toBe(true);
  });
});
