# Validation indépendante du noyau de simulation (T-005, T-023)

Ce dossier contient de quoi rejouer la validation du noyau `src/sim` contre un oracle **exact**
écrit en MATLAB, indépendant de RK4 : la boucle P du niveau 1 (T-005, rapport dans
[`docs/validation/T-005-noyau.md`](../docs/validation/T-005-noyau.md)) et la boucle PI du
niveau 2 (T-023, spec T-018 §8, scripts `t018_*.m`).

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
| `data/ts_sweep_summary.csv` | balayage TS Kp = 100…8000 sur 1200 pas : y_max, état final, pas saturés, issue, pas     |

Contrôleur PI du niveau 2 (T-023, spec T-018 §8) :

| Fichier                     | Rôle                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `matlab/t018_params.m`      | paramètres du niveau 2 (Kp = 2500, poutre, tolérance 0,10 m, 1200 pas), recopiés           |
| `matlab/t018_pi_oracle.m`   | simulation exacte pas à pas du PI : u = Kp·e + I, puis I ← I + Ki·dt·e, saturation, sol    |
| `matlab/t018_issue.m`       | issue du niveau 2 (`bonk`, `win`, `step`, `slow`), règles recopiées                        |
| `matlab/t018_A.m`           | trajectoires TS contre oracle exact, au pas par pas (y, ẏ, I, uCmd, uSat, drapeau, issue)  |
| `matlab/t018_phases.m`      | contrôle de l'oracle par morceaux : phase saturée en forme fermée, phase linéaire M^n      |
| `matlab/t018_stability.m`   | Ki critique de la boucle échantillonnée (valeurs propres, Jury, simulation), pôle lent     |
| `matlab/t018_window.m`      | fenêtre de Ki (grille de 100 et points fins), 0 désaccord TS / exact, bornes continues     |
| `matlab/t018_run_all.m`     | enchaîne les quatre points ; s'arrête (`assert`) dès qu'un critère n'est pas tenu          |
| `data/pi_traj_dt120.csv`    | trajectoires TS du PI (y, ẏ, I, uCmd, uSat, drapeau) pour 11 Ki, Kp = 2500, 1200 pas       |
| `data/pi_sweep_summary.csv` | balayage TS de Ki (0…8000 par 100, 120…140 et 840…850 par 1) : issue, pas, pic, I, saturés |

## Relancer la validation

Depuis la racine du dépôt, dans MATLAB :

```matlab
run('validation/matlab/t005_run_all.m')
```

La dernière ligne affichée doit être `T005 : FIN SANS ERREUR`. Chaque script peut aussi être lancé
seul (`run('validation/matlab/t005_C.m')`, etc.) : il retrouve la racine du dépôt à partir de son
propre emplacement.

Pour le contrôleur PI :

```matlab
run('validation/matlab/t018_run_all.m')
```

La dernière ligne affichée doit être `T018 : FIN SANS ERREUR` ; elle n'apparaît que si tous les
critères sont tenus (sinon `assert` arrête le script avec un message). Hors de MATLAB interactif :
`matlab -batch "run('validation/matlab/t018_run_all.m')"` depuis la racine du dépôt (environ
35 s). Les scripts `t018_*.m` réutilisent `t005_zoh.m`.

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
    for (let k = 1; k <= 1200; k++) {
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
      kIssue = 1200;
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

### CSV du contrôleur PI (T-023)

Même méthode : recréer `tests/sim/zz_t018_export.test.ts` avec le contenu ci-dessous, lancer
`npx vitest run tests/sim/zz_t018_export.test.ts`, puis **supprimer le fichier**. L'issue du
balayage est celle de l'arbitre du jeu (`createOutcomeJudge2`), pas une recopie des règles.

```ts
// FICHIER TEMPORAIRE T-023 : exporte les trajectoires et le balayage du PI en CSV. À SUPPRIMER après usage.
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { createOutcomeJudge2 } from '../../src/game/outcome';
import { createElevatorPiLoop } from '../../src/sim';

const KP = 2500;
const STEPS = 1200;
const KIS = [0, 130, 200, 500, 800, 840, 850, 1000, 2000, 4000, 8000];
const OUT = 'validation/data';
const f = (v: number): string => v.toPrecision(17);

function sweepKis(): number[] {
  const set = new Set<number>();
  for (let ki = 0; ki <= 8000; ki += 100) set.add(ki);
  for (let ki = 120; ki <= 140; ki++) set.add(ki);
  for (let ki = 840; ki <= 850; ki++) set.add(ki);
  return [...set].sort((a, b) => a - b);
}

it('export', () => {
  mkdirSync(OUT, { recursive: true });
  // Trajectoires : ligne k = état après k pas ; uCmd, uSat, sat = commande du k-ième pas.
  const cols: string[][] = [];
  for (const ki of KIS) {
    const loop = createElevatorPiLoop({ kp: KP, ki });
    const y = [f(0)];
    const v = [f(0)];
    const i = [f(0)];
    const uc = ['NaN'];
    const us = ['NaN'];
    const sat = ['NaN'];
    for (let k = 0; k < STEPS; k++) {
      const s = loop.step();
      y.push(f(s.x[0] as number));
      v.push(f(s.x[1] as number));
      i.push(f(loop.controller.integral));
      uc.push(f(s.uCmd));
      us.push(f(s.uSat));
      sat.push(s.saturated ? '1' : '0');
    }
    cols.push(y, v, i, uc, us, sat);
  }
  const head = [
    'k',
    ...KIS.flatMap((ki) => [
      `y_${ki}`,
      `v_${ki}`,
      `i_${ki}`,
      `ucmd_${ki}`,
      `usat_${ki}`,
      `sat_${ki}`,
    ]),
  ].join(',');
  const lines = [head];
  for (let k = 0; k <= STEPS; k++) lines.push([String(k), ...cols.map((c) => c[k])].join(','));
  writeFileSync(`${OUT}/pi_traj_dt120.csv`, lines.join('\n') + '\n');

  // Balayage de Ki : issue selon l'arbitre du niveau 2 du jeu (createOutcomeJudge2).
  const rows = ['ki,issue,k_issue,y_max,k_ymax,i_max,sat_steps,k_star,y_final,v_final,i_final'];
  for (const ki of sweepKis()) {
    const loop = createElevatorPiLoop({ kp: KP, ki });
    const judge = createOutcomeJudge2();
    let yMax = 0;
    let kMax = 0;
    let iMax = 0;
    let sat = 0;
    let kStar = -1;
    let issue = '';
    let kIssue = -1;
    for (let k = 1; k <= STEPS; k++) {
      const s = loop.step();
      if (s.saturated) sat++;
      else if (kStar < 0) kStar = k;
      const y = s.x[0] as number;
      if (y > yMax) {
        yMax = y;
        kMax = k;
      }
      iMax = Math.max(iMax, loop.controller.integral);
      if (issue === '') {
        const verdict = judge.evaluate(k, y, s.x[1] as number, KP);
        if (verdict !== null) {
          issue = verdict;
          kIssue = k;
        }
      }
    }
    rows.push(
      [
        ki,
        issue,
        kIssue,
        f(yMax),
        kMax,
        f(iMax),
        sat,
        kStar,
        f(loop.x[0] as number),
        f(loop.x[1] as number),
        f(loop.controller.integral),
      ].join(','),
    );
  }
  writeFileSync(`${OUT}/pi_sweep_summary.csv`, rows.join('\n') + '\n');
});
```

Colonnes de `pi_traj_dt120.csv` : pour chaque Ki, `y_<Ki>` (m), `v_<Ki>` (m/s), `i_<Ki>` (I en N,
après le pas), puis `ucmd_<Ki>`, `usat_<Ki>` (N) et `sat_<Ki>` (0 ou 1) : commande du k-ième pas,
`NaN` à la ligne 0. Colonnes de `pi_sweep_summary.csv` : `k_issue` = pas de l'issue (1200 pour
une fin de temps), `k_ymax` = pas du pic échantillonné, `k_star` = premier pas non saturé,
`i_max` = intégrale maximale (N), `*_final` = état après 1200 pas.

Le report en TypeScript de l'oracle du PI est `tests/sim/pi-exact.test.ts` (forme fermée, sans
MATLAB, lancé par `npm test`).
