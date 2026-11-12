import { MAX_SIM_DT } from './clock';
import { isSaturated, saturate } from './saturation';
import type { ClosedLoop, ClosedLoopConfig, LoopSample } from './types';

/** Boucle fermée dont le compteur de pas et l'état courant sont lisibles. */
export interface SteppableClosedLoop extends ClosedLoop {
  /** Nombre de pas exécutés depuis la création ou le dernier `reset` (sans unité). */
  readonly k: number;
  /** Pas de simulation dt (s). */
  readonly dt: number;
  /**
   * État courant x(k·dt) (unités du modèle). C'est le tableau interne de la boucle, le même
   * objet que `LoopSample.x` : à lire, jamais à modifier, et à copier pour le conserver.
   */
  readonly x: Readonly<Float64Array>;
}

/**
 * Crée une boucle fermée à pas fixe (spec T-001 §4, « Algorithme d'un pas »).
 *
 * `step()` exécute, dans cet ordre normatif, au pas d'indice k (temps t = k·dt, calculé par
 * multiplication et jamais accumulé) :
 * 1. r = setpoint(t), y = plant.output(x), e = r − y ;
 * 2. uCmd = 0 si la boucle est désactivée (le contrôleur n'est alors pas appelé), sinon
 *    uCmd = controller.update(r, y, dt) ;
 * 3. uSat = min(max(uCmd, min), max), saturated = (uSat ≠ uCmd) ({@link saturate}, {@link isSaturated}) ;
 * 4. integrator.step(plant, x, uSat, dt) : uSat constant pendant le pas (bloqueur d'ordre zéro) ;
 * 5. plant.constrain(x) ; k ← k + 1.
 *
 * Échantillon renvoyé : un objet unique, alloué à la création et réécrit à chaque pas
 * (aucune allocation dans `step`, spec §4). Ses champs k, t, r, y, e, uCmd, uSat, saturated
 * décrivent l'instant t = k·dt où la commande a été calculée ; `x` est l'état APRÈS le pas,
 * soit x((k + 1)·dt). Ainsi la mesure au pas k + 1 vaut `plant.output(sample.x)` du pas k.
 * Le copier si on veut le garder au-delà du pas suivant.
 *
 * L'état initial est copié à la création : modifier `config.x0` ensuite n'a aucun effet.
 * Il doit être fini et déjà respecter les contraintes du modèle, c'est-à-dire que
 * `plant.constrain` le laisse inchangé (pour l'ascenseur : y0 ≥ 0). La boucle démarre activée.
 *
 * Consigne : `setpoint` étant une fonction du temps, sa valeur ne peut être validée qu'au
 * moment où elle est lue. `step()` vérifie donc `Number.isFinite(r)` à chaque pas (une
 * comparaison, aucune allocation) et lève `RangeError` AVANT toute autre action : contrôleur
 * non appelé, état, k et échantillon inchangés. La fonction n'est jamais appelée à la
 * création (une consigne impure garde exactement un appel par pas).
 * @param config modèle, contrôleur, saturation (N), intégrateur, pas dt (s), état initial,
 *   consigne r(t) (m).
 * @throws RangeError si dt n'est pas fini et dans ]0, {@link MAX_SIM_DT}], si
 *   `x0.length ≠ plant.stateSize`, si x0 contient une valeur non finie, ou si x0 viole les
 *   contraintes du modèle (cabine sous le sol). `step()` lève RangeError si la consigne lue
 *   n'est pas finie.
 */
export function createClosedLoop(config: ClosedLoopConfig): SteppableClosedLoop {
  const { plant, controller, saturation, integrator, dt, setpoint } = config;
  if (!Number.isFinite(dt) || dt <= 0 || dt > MAX_SIM_DT) {
    throw new RangeError(
      `dt doit être fini, > 0 et ≤ MAX_SIM_DT = ${String(MAX_SIM_DT)} s (reçu ${String(dt)})`,
    );
  }
  if (config.x0.length !== plant.stateSize) {
    throw new RangeError(
      `x0 de dimension ${String(config.x0.length)}, modèle de dimension ${String(plant.stateSize)}`,
    );
  }
  const x0 = Float64Array.from(config.x0);
  if (!x0.every(Number.isFinite)) {
    throw new RangeError(`x0 doit être fini (reçu [${x0.join(', ')}])`);
  }
  const constrained = Float64Array.from(x0);
  plant.constrain(constrained);
  if (!constrained.every((v, i) => v === x0[i])) {
    throw new RangeError(
      `x0 viole les contraintes du modèle (reçu [${x0.join(', ')}], contraint [${constrained.join(', ')}])`,
    );
  }
  const x = Float64Array.from(x0);
  let k = 0;
  let enabled = true;

  /** Échantillon réutilisé (spec §4 : aucune allocation dans step). */
  const sample: LoopSample = {
    k: 0,
    t: 0,
    r: 0,
    y: 0,
    e: 0,
    uCmd: 0,
    uSat: 0,
    saturated: false,
    x,
  };

  return {
    dt,
    x,
    get k(): number {
      return k;
    },
    get enabled(): boolean {
      return enabled;
    },
    setEnabled(on: boolean): void {
      enabled = on;
    },
    reset(): void {
      x.set(x0);
      k = 0;
      enabled = true;
      controller.reset();
    },
    step(): LoopSample {
      // 1. Mesure à t = k·dt.
      const t = k * dt;
      const r = setpoint(t);
      if (!Number.isFinite(r)) {
        throw new RangeError(`consigne non finie à t = ${String(t)} s (reçu ${String(r)})`);
      }
      const y = plant.output(x);
      const e = r - y;
      // 2. Commande.
      const uCmd = enabled ? controller.update(r, y, dt) : 0;
      // 3. Saturation.
      const uSat = saturate(uCmd, saturation);
      // 4. Intégration à commande constante (bloqueur d'ordre zéro). 5. Contraintes.
      integrator.step(plant, x, uSat, dt);
      plant.constrain(x);

      sample.k = k;
      sample.t = t;
      sample.r = r;
      sample.y = y;
      sample.e = e;
      sample.uCmd = uCmd;
      sample.uSat = uSat;
      sample.saturated = isSaturated(uCmd, uSat);
      k += 1;
      return sample;
    },
  };
}
