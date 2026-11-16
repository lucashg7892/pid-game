/**
 * Colonne du centre du pupitre : « la machine » (T-050, décisions D35 et D36). L'écorché du moteur du
 * treuil (carcasse, rotor animé, balais, tambour, câble, cabine au bout du câble, coupe A-A, règle de
 * hauteur, étincelles et rouge en saturation), la rangée de voyants Marche, Pause, Saturation et Fin,
 * et la jauge de force verticale (force appliquée et force demandée, saturation visible à ±5 000 N).
 * Dessin de la maquette A du lot B (v0.3), voir `machine-fond.ts` et `machine-vif.ts`.
 *
 * La colonne ne lit pas le jeu directement : elle dessine un {@link EtatMachine} construit à chaque
 * image par {@link etatMachineDirect} d'après l'état du pupitre. Le curseur du trajet (T-051) fera le
 * même état d'après le journal : il suffit de remplacer l'appel à `etatMachineDirect` (voir
 * `choisirEtat` dans {@link OptionsMachine}).
 */
import type { ColonnePupitre, EtatPupitre } from './colonne';
import { dessinerFondMachine } from './machine-fond';
import {
  animationMachine,
  etatMachineDirect,
  etatMachineVide,
  resumeMachine,
  type AnimationMachine,
  type EtatMachine,
} from './machine-etat';
import { creerMemoireTextes, dessinerVifMachine, majTextes } from './machine-vif';

/** Options de {@link creerColonneMachine}. */
export interface OptionsMachine {
  /**
   * Remplit l'état à afficher d'après l'état du pupitre. Défaut : le jeu en direct
   * ({@link etatMachineDirect}). Le curseur du trajet (T-051) fournit ici un état construit d'après
   * `etat.journal` à l'indice du curseur.
   * @param etat état du pupitre (à lire, jamais à modifier).
   * @param sortie état de la machine à réécrire sans allocation.
   * @returns `sortie`.
   */
  readonly choisirEtat?: (etat: Readonly<EtatPupitre>, sortie: EtatMachine) => EtatMachine;
}

/**
 * Crée la colonne du centre.
 * @param options voir {@link OptionsMachine}.
 */
export function creerColonneMachine(options: OptionsMachine = {}): ColonnePupitre {
  const choisir = options.choisirEtat ?? etatMachineDirect;
  const machine = etatMachineVide();
  const anim: AnimationMachine = { pulse: 1, secousse: 0 };
  const memoire = creerMemoireTextes();
  const pourResume = etatMachineVide();
  return {
    id: 'machine',
    dessinerFond(ctx, rect, etat): void {
      dessinerFondMachine(ctx, rect, etat.traducteur);
    },
    dessiner(ctx, rect, etat): void {
      choisir(etat, machine);
      animationMachine(etat.maintenant, etat.mouvementReduit, etat.enPause, anim);
      const textes = majTextes(memoire, machine, etat.traducteur);
      dessinerVifMachine(ctx, rect, machine, anim, textes);
    },
    resume(etat): string {
      return resumeMachine(choisir(etat, pourResume), etat.traducteur);
    },
  };
}
