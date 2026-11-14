# Validation indépendante du noyau de simulation (T-005)

Ce dossier contient de quoi rejouer la validation du noyau `src/sim` contre un oracle **exact**
écrit en MATLAB, indépendant de RK4. Le rapport se trouve dans
[`docs/validation/T-005-noyau.md`](../docs/validation/T-005-noyau.md).

MATLAB sert uniquement à la validation : rien de ce dossier n'est importé par le site.

## Prérequis

- MATLAB R2025a (testé avec 25.1.0.2943329). **Aucune toolbox** : seules des fonctions de base
  sont utilisées (`expm`, `ode45`, `fzero`, `eig`, `readmatrix`, `readtable`).
- Pour régénérer les CSV : Node 22 et les dépendances du dépôt (`npm ci`).

## Contenu

| Fichier                     | Rôle                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `matlab/t005_params.m`      | paramètres de la spec T-001 §5 (recopiés, jamais lus dans le code TS)                   |
| `matlab/t005_zoh.m`         | discrétisation exacte par `expm` (Van Loan) + contrôle par la forme fermée              |
| `matlab/t005_oracle.m`      | simulation exacte pas à pas : P, saturation, bloqueur d'ordre zéro, sol, max entre pas  |
| `matlab/t005_issue.m`       | issue du niveau selon la spec §6 (choc, victoire, trop faible, ne décolle pas)          |
| `matlab/t005_A_B.m`         | points A et B : écart TS/exact, ordre de convergence, tableau de référence de la spec   |
| `matlab/t005_C.m`           | point C : boucle continue (`ode45`) contre formules, effet du bloqueur d'ordre zéro     |
| `matlab/t005_D.m`           | point D : Kp critique de la boucle échantillonnée (valeurs propres, Jury, forme fermée) |
| `matlab/t005_E.m`           | point E : fenêtre de jeu Kp = 100…8000, marges à la poutre                              |
| `matlab/t005_run_all.m`     | enchaîne A à E                                                                          |
| `data/ts_traj_dt120.csv`    | trajectoires TS (y, ẏ) pour 12 Kp, dt = 1/120 s, 1200 pas, 17 chiffres significatifs    |
| `data/ts_traj_dt240.csv`    | idem, dt = 1/240 s, 2400 pas (contrôle de l'ordre 4)                                    |
| `data/ts_sweep_summary.csv` | balayage TS Kp = 100…8000 sur 720 pas : y_max, état final, pas saturés, issue, pas      |

## Relancer la validation

Depuis la racine du dépôt, dans MATLAB :

```matlab
run('validation/matlab/t005_run_all.m')
```

La dernière ligne affichée doit être `T005 : FIN SANS ERREUR`. Chaque script peut aussi être lancé
seul (`run('validation/matlab/t005_C.m')`, etc.) : il retrouve la racine du dépôt à partir de son
propre emplacement.

## Régénérer les CSV du code TypeScript

Les CSV ont été produits par un test Vitest temporaire, supprimé après usage pour ne pas polluer
`tests/`. Pour les régénérer (après une modification du noyau, par exemple), recréer
`tests/sim/zz_t005_export.test.ts` avec le contenu ci-dessous, lancer
`npx vitest run tests/sim/zz_t005_export.test.ts`, puis **supprimer le fichier**.

```ts
// FICHIER TEMPORAIRE T-005 : exporte les trajectoires TS en CSV. À SUPPRIMER après usage.
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { createElevatorLoop } from '../../src/sim';

const KPS = [150, 500, 1000, 1500, 2000, 2500, 3000, 3500, 3800, 3900, 4500, 8000];
const OUT = 'validation/data';
const f = (v: number): string => v.toPrecision(17);

function exportTraj(dtDen: number, steps: number): void {
  const cols: number[][] = [];
  for (const kp of KPS) {
    const loop = createElevatorLoop({ kp, dt: 1 / dtDen });
    const y = [loop.x[0] as number];
    const v = [loop.x[1] as number];
    for (let k = 0; k < steps; k++) {
      const s = loop.step();
      y.push(s.x[0] as number);
      v.push(s.x[1] as number);
    }
    cols.push(y, v);
  }
  const head = ['k', ...KPS.flatMap((kp) => [`y_${kp}`, `v_${kp}`])].join(',');
  const lines = [head];
  for (let k = 0; k <= steps; k++)
    lines.push([String(k), ...cols.map((c) => f(c[k] as number))].join(','));
  writeFileSync(`${OUT}/ts_traj_dt${dtDen}.csv`, lines.join('\n') + '\n');
}

it('export', () => {
  mkdirSync(OUT, { recursive: true });
  exportTraj(120, 1200);
  exportTraj(240, 2400);
  const lines = ['kp,y_max,k_ymax,y_final,v_final,sat_steps,issue,k_issue'];
  for (let kp = 100; kp <= 8000; kp += 100) {
    const loop = createElevatorLoop({ kp });
    let yMax = 0;
    let kMax = 0;
    let sat = 0;
    let run = 0;
    let issue = '';
    let kIssue = -1;
    for (let k = 1; k <= 720; k++) {
      const s = loop.step();
      if (s.saturated) sat++;
      const y = s.x[0] as number;
      if (y > yMax) {
        yMax = y;
        kMax = k;
      }
      if (issue === '') {
        if (y > 3.3626) {
          issue = 'choc';
          kIssue = k;
        } else {
          run = Math.abs(3 - y) <= 0.5 && Math.abs(s.x[1] as number) <= 0.1 ? run + 1 : 0;
          if (run >= 120) {
            issue = 'victoire';
            kIssue = k;
          }
        }
      }
    }
    if (issue === '') {
      issue = kp <= 163.5 ? 'decolle_pas' : 'trop_faible';
      kIssue = 720;
    }
    lines.push(
      [kp, f(yMax), kMax, f(loop.x[0] as number), f(loop.x[1] as number), sat, issue, kIssue].join(
        ',',
      ),
    );
  }
  writeFileSync(`${OUT}/ts_sweep_summary.csv`, lines.join('\n') + '\n');
});
```

Convention des CSV : la ligne `k` donne l'état **après** k pas, soit x(k·dt) ; la ligne 0 est
l'état initial (0, 0).
