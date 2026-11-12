# Tests

## Ce qui existe aujourd'hui (socle validé T-002)

La tâche T-003 (noyau : horloge, saturation, RK4, enregistreur) est en cours et modifie `src/sim/`, `tests/sim/`, `package.json` et `vitest.config.ts`. Ces changements ne sont pas validés et ne sont pas décrits ici.

Un seul test unitaire, le test fumée `tests/smoke.test.ts`. Il vérifie que `SIM_DT` (exporté par `src/sim/index.ts`) vaut exactement `1 / 120` s, le pas fixe de la spec T-001 §4.

Configuration Vitest (`vitest.config.ts`, options du socle T-002) :

| Option | Valeur |
|---|---|
| `environment` | `node` |
| `include` | `tests/**/*.test.ts` |
| `exclude` | `tests/e2e/**`, `node_modules/**`, `dist/**` |

Lancer les tests :

```sh
npm run test
```

`npm run check` enchaîne typecheck, lint, tests et build. L'orchestrateur l'a relancé pendant la validation de T-002 : code de sortie 0 (log T-002).

Dans le socle validé : aucun test e2e, aucune mesure de couverture, aucune CI.

## Stratégie prévue

Résumé de la spec T-001 §5 et §9. Tout ce qui suit est **Prévu**.

### Noyau de simulation — Prévu (T-003, T-004)

- Intégrateur RK4 : sur ẋ = −x, x0 = 1, dt = 0,1 s, 10 pas, écart à e⁻¹ ≤ 1e-6 (T-003).
- Horloge à pas fixe : images de 1/30, 1/60, 1/144 s et à-coups de 0,5 s ; plafond de 8 pas par image ; `alpha` ∈ [0, 1) (T-003).
- Couverture de `src/sim` ≥ 95 % des lignes via un script `npm run test:cov` (T-003).
- Oracle analytique de l'ascenseur, saturation désactivée (T-004) :

| Test | Vérification | Tolérance |
|---|---|---|
| T1 | erreur statique à t = 10 s vs m·g/Kp, dt = 1/120 s, Kp ∈ {500, 1000, 2500, 4000, 8000} N/m | 1e-6 m |
| T2 | dépassement, dt = 1/1000 s, Kp ∈ {1000, 2500, 4000} N/m | 0,5 point de % |
| T3 | dépassement, dt = 1/120 s | entre Mp analytique et Mp + 2,5 points |
| T4 | instant du pic, dt = 1/1000 s, Kp = 2500 N/m | 0,01 s |
| T5 | Kp = 150 N/m : la cabine ne décolle pas sur 10 s | y = 0 |

- Valeurs de référence du jeu (saturation ±5000 N active) : tolérance 1e-6 m (T-004).
- Déterminisme (T-004) : deux exécutions identiques bit à bit ; mêmes états quelle que soit la cadence d'images (1/60 s ou 1/144 s) ; empreinte SHA-256 figée de la trace Kp = 2500 N/m.

### Logique de jeu — Prévu (T-007)

Issues attendues pour Kp ∈ {150, 1500, 2500, 3500, 4500} N/m : ne décolle pas, marche trop haute, victoire, victoire, choc. Victoire de Kp = 2500 N/m au pas 291 ± 1. `reset` restaure l'état initial.

### i18n — Prévu (T-006)

Parité des clés FR/EN, interpolation, format des nombres (`0,2` en FR, `0.2` en EN).

### Bout en bout — Prévu (T-010)

Playwright, Chromium seul, sur `vite preview` :

- `?renderer=webgl&lang=en` : aucune erreur console, niveau joué au clavier avec Kp = 2500 N/m, message de victoire en ≤ 10 s ;
- `?renderer=none` : page de repli.

WebGL2 est forcé car WebGPU n'est pas garanti dans Chromium sans écran (spec T-001 §9).

### Intégration continue — Prévu (T-011)

Node 22, `npm ci`, `npm run check`, `npm run e2e`.

### Validation indépendante — Prévu (T-005)

Un validateur recalcule l'oracle par un script indépendant et compare aux résultats de `npm run test`.
