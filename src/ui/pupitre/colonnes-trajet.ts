/**
 * Colonnes du centre et de droite du pupitre, branchées ensemble (T-051) : la machine et les courbes
 * partagent le curseur du trajet. À l'issue, le curseur reparcourt le journal ; la machine montre la
 * cabine, les forces et la saturation de l'instant du curseur, les courbes en lisent les valeurs.
 */
import type { ColonnePupitre } from './colonne';
import { creerColonneCourbes } from './courbes';
import { choisirEtatMachine, creerCurseur } from './curseur';
import { creerColonneMachine } from './machine';

/**
 * Crée la machine et les courbes, reliées par un même curseur du trajet.
 * @returns les deux colonnes, à passer à `creerPupitre` (option `colonnes`).
 */
export function creerColonnesTrajet(): ColonnePupitre[] {
  const curseur = creerCurseur();
  return [
    creerColonneMachine({ choisirEtat: choisirEtatMachine(curseur) }),
    creerColonneCourbes({ curseur }),
  ];
}
