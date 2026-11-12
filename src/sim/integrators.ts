import type { Integrator, PlantModel } from './types';

/**
 * Crée un intégrateur Runge-Kutta classique d'ordre 4 (RK4) pour un état de dimension
 * `stateSize`. Les tampons de travail (k1..k4 et l'état intermédiaire) sont alloués ici, une
 * fois : `step` n'alloue rien. La commande `u` (N) est constante pendant le pas (bloqueur
 * d'ordre zéro). `step` n'applique pas `constrain` : c'est le rôle de la boucle (spec §4, étape 5).
 * @param stateSize dimension de l'état, entier ≥ 1.
 * @throws RangeError si `stateSize` est invalide ; `step` lève RangeError si `x.length` ou
 *   `m.stateSize` diffère de `stateSize`.
 */
export function createRk4(stateSize: number): Integrator {
  if (!Number.isInteger(stateSize) || stateSize < 1) {
    throw new RangeError(`stateSize doit être un entier ≥ 1 (reçu ${String(stateSize)})`);
  }
  const k1 = new Float64Array(stateSize);
  const k2 = new Float64Array(stateSize);
  const k3 = new Float64Array(stateSize);
  const k4 = new Float64Array(stateSize);
  const tmp = new Float64Array(stateSize);

  return {
    step(m: PlantModel, x: Float64Array, u: number, dt: number): void {
      if (x.length !== stateSize || m.stateSize !== stateSize) {
        throw new RangeError(
          `dimension d'état attendue ${String(stateSize)}, reçue x=${String(x.length)}, modèle=${String(m.stateSize)}`,
        );
      }
      const half = 0.5 * dt;
      m.derivative(x, u, k1);
      for (let i = 0; i < stateSize; i++) tmp[i] = (x[i] as number) + half * (k1[i] as number);
      m.derivative(tmp, u, k2);
      for (let i = 0; i < stateSize; i++) tmp[i] = (x[i] as number) + half * (k2[i] as number);
      m.derivative(tmp, u, k3);
      for (let i = 0; i < stateSize; i++) tmp[i] = (x[i] as number) + dt * (k3[i] as number);
      m.derivative(tmp, u, k4);
      const sixth = dt / 6;
      for (let i = 0; i < stateSize; i++) {
        x[i] =
          (x[i] as number) +
          sixth *
            ((k1[i] as number) + 2 * (k2[i] as number) + 2 * (k3[i] as number) + (k4[i] as number));
      }
    },
  };
}
