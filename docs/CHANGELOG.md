# Journal des modifications

À quoi sert cette page : retrouver ce que chaque tâche validée a apporté, avec ses réserves, et le commit qui la contient. Une entrée par tâche, la plus récente en premier (ordre des commits). Sources : `orchestration/REGISTRE.md`, `orchestration/logs/` et `git log --oneline`.

## Correspondance tâche → commit

Sortie de `git log --oneline` sur `main` (9 commits, tous du 2026-11-12).

| Commit | Contenu |
|---|---|
| `c00e678` | registre : logs T-004b et T-006 |
| `1ee1010` | T-006 : i18n FR/EN |
| `bf7fd65` | licence MIT (`LICENSE`) et registre d'orchestration (T-000 à T-005) |
| `9569ca4` | T-005 : validation indépendante du noyau, rapport et scripts MATLAB |
| `1dc5f7e` | D-002 : documentation technique initiale |
| `beb6086` | T-003, T-004 et T-004b : noyau de simulation et ses tests (un seul commit pour les trois tâches) |
| `ff1bb60` | T-002 : socle outillé (`package.json` et `vitest.config.ts` y sont déjà dans leur état après T-003, avec `test:cov`) |
| `d57b05b` | T-001 : spécification |
| `e627a96` | T-000 : initialisation du dépôt |

Les commits ont été créés après coup, à la suite, à partir de l'état validé : leur ordre ne suit pas exactement l'ordre des validations (T-004b, validée après T-005, est dans `beb6086`).

## T-006 — Internationalisation FR/EN (2026-11-12)

- Ajoute `src/i18n/` (7 fichiers TypeScript, `locales/fr.json`, `locales/en.json`, 89 clés par langue) et `tests/i18n/` (5 fichiers, 70 tests). Voir [i18n-accessibilite.md](i18n-accessibilite.md).
- Interpolation stricte (`I18nError`), clés et paramètres typés, formatage par `Intl.NumberFormat`, détection de langue, traducteur avec abonnés. Aucune bibliothèque externe, aucun tsconfig modifié.
- Vérification de l'orchestrateur : parité des clés et typographie contrôlées par un script indépendant ; `npm run check` code 0 (169 tests, 21 modules sans violation) ; `npm run test:cov` 100 % sur `src/sim`.
- Commit : `1ee1010`.
- Statut : validé. Points reportés :
  - titre du jeu (« PID au crayon » / « Pencil PID ») : décision de l'utilisateur ;
  - textes de la spec §6 enrichis (voir [errata](specs/T-001-errata.md)) ;
  - contrat T-007/T-010 : paramètres = chaînes déjà formatées ;
  - T-010 : bouton de langue avec attribut `lang`, rendu de U+202F dans la police manuscrite.

## T-004b — Corrections du noyau issues de T-005 (2026-11-12)

- Traite les défauts D-1 (consigne non finie → `RangeError`), D-2 (borne `MAX_SIM_DT` = 1/30 s), D-4 (test de σ à Kp = 8000), D-6 (test de trajectoire exacte `tests/sim/exact.test.ts`), D-7 (état initial invalide → `RangeError`), D-12 (signal inconnu → `RangeError`).
- `tests/sim/` : 9 fichiers, 98 tests verts. `reference.test.ts` et `determinism.test.ts` inchangés.
- Commit : `beb6086` (avec T-003 et T-004).
- Statut : validé. Réserves :
  - couverture et `npm run check` global d'abord crus sur la sortie de l'agent, puis reconfirmés pendant la validation de T-006 ;
  - l'horloge `createFixedStepClock` n'est pas bornée en `dt` ; la boucle refuse un `dt` trop grand ;
  - deux tests de `loop.test.ts` adaptés (dt 0,1 et 0,5 s désormais hors borne), intention inchangée.

## T-005 — Validation indépendante du noyau (2026-11-12)

- Ajoute `validation/` (9 scripts MATLAB, 3 CSV, `README.md`) et le rapport [validation/T-005-noyau.md](validation/T-005-noyau.md). Oracle exact par exponentielle de matrice, sans RK4.
- Écart RK4 / exact ≤ 1,42e-7 m ; Kp critique 97 079 N/m à dt = 1/120 s ; fenêtre [2000 ; 3800] N/m confirmée ; 8 mutants tués sur 8.
- Vérification de l'orchestrateur : `t005_run_all.m` relancé dans MATLAB, « FIN SANS ERREUR », mêmes chiffres.
- Commit : `9569ca4`.
- Statut : validé avec réserves (noyau validé avec réserves, aucun défaut bloquant ni majeur). Suites :
  - D-1, D-2, D-6, D-7 → T-004b (fait) ;
  - D-3, D-4, D-5, D-10 → errata de spec (D-004 : [specs/T-001-errata.md](specs/T-001-errata.md)) ;
  - D-8, D-11 → T-007 (ne pas garder de référence à l'échantillon ; figer les issues à 3800 et 3900 N/m) ;
  - D-9 (Kp non borné) : documenté, non corrigé.

## D-002 — Documentation technique initiale (2026-11-12)

- Ajoute `README.md`, `docs/README.md`, `architecture.md`, `developpement.md`, `tests.md`, `CHANGELOG.md` et les ADR-001 à ADR-004. Couvre T-000 à T-002.
- Vérification de l'orchestrateur : 20 liens relatifs, 0 cassé ; scripts npm conformes à `package.json`.
- Commit : `1dc5f7e`.
- Statut : validé. Signalements : `LICENSE` absent à l'époque (ajouté depuis, `bf7fd65`) ; `npm run e2e` échoue sans configuration (→ T-010) ; `.nvmrc` = `22` alors que le minimum est 22.12 ; depcruise n'analyse que `src/`.

## T-004 — Noyau : contrôleur P, ascenseur, boucle, oracle (2026-11-12)

- Ajoute `src/sim/controllers/p.ts`, `src/sim/plants/elevator.ts`, `src/sim/loop.ts` et les tests `oracle`, `reference`, `determinism` (79 tests au total à cette date, couverture `src/sim` 100 %).
- Empreinte SHA-256 de la trace Kp = 2500 : `5f85e15aa78afeeb834bf30e651b062be643a3e763b2821d7d534bcbbb38a821`.
- Vérification de l'orchestrateur : réimplémentation Python sur Kp = 3000 et 3900 (non couverts par les tests), identique à tous les chiffres affichés.
- Commit : `beb6086`.
- Statut : validé. Points reportés :
  - coquille t_pic de la spec §5 (errata n° 1) ;
  - piège de `LoopSample` : `x` est l'état après le pas (voir [simulation.md](simulation.md#le-piège-de-loopsample)) ;
  - `reset()` réactive la boucle ; contrôleur désactivé = `update` non appelé (à revoir pour un futur PI) ;
  - marge faible du test σ à Kp = 4000 (4,24 % pour un seuil de 5 %) ;
  - hauteur de poutre et tolérance de marche laissées à T-007.

## T-003 — Noyau : horloge, saturation, RK4, enregistreur (2026-11-12)

- Ajoute `src/sim/{types,clock,saturation,integrators,signals}.ts` et leurs tests (34 tests), le script `test:cov` et `@vitest/coverage-v8` 5.1.0.
- Vérification de l'orchestrateur : `npm run test:cov` 100 % ; contre-épreuve masse-ressort-amortisseur (écart 1,5e-8) et horloge sur 6000 images irrégulières (12 000 pas pour 100,0 s).
- Commit : `beb6086`.
- Statut : validé. Choix acceptés, documentés dans [simulation.md](simulation.md) :
  - saturation : NaN propagé, drapeau faux ; bornes invalides → `RangeError` ;
  - horloge : accumulateur en pas, epsilon 1e-9 pas, plafond 0,25 s par image, fraction conservée au plafond ;
  - interfaces étendues : `reset()` de l'horloge, `buffer` et `clear()` de l'enregistreur.

## T-002 — Socle outillé (2026-11-12)

- Commit : `ff1bb60`.

- Ajoute `package.json` (versions épinglées), `package-lock.json`, `.nvmrc`, configurations TypeScript, Vite, Vitest, ESLint, Prettier et dependency-cruiser, `index.html`, bouchons `src/main.ts`, `src/sim/index.ts`, `src/render/index.ts` et un test fumée.
- `npm run check` : code 0. Bundle JS : 219,75 kB gzip. Une violation volontaire dans `src/sim` fait échouer les trois garde-fous.
- Statut : validé avec réserves.
  - E2 : `src/main.ts` exempté de `three-only-in-render` → T-008.
  - E3 : `docs/` et `orchestration/` exclus de Prettier (prose).
  - E5 : pas de script `test:cov` → T-003 (fait).
  - E7 : 10 vulnérabilités modérées dans la chaîne de lint (développement seulement).
  - E9 : comportement du renderer dans un navigateur non exécuté → T-008.
  - E11 : un processus en arrière-plan ne survit pas à un appel du shell de la VM.

## T-001 — Spécification de la tranche verticale (2026-11-12)

- Commit : `d57b05b`. Corrections ultérieures : [specs/T-001-errata.md](specs/T-001-errata.md).

- Ajoute `docs/specs/T-001-tranche-verticale.md` : versions des dépendances, architecture, noyau, modèle de l'ascenseur, niveau 1, rendu, tests, plan de tâches.
- Calculs de référence recalculés à la main par l'orchestrateur (Kp = 2500 N/m : e_ss = 0,1962 m, ζ = 0,566, dépassement 11,6 %).
- Statut : validé. Points à surveiller : parité JS des valeurs de référence (T-004), repli WebGL2 non exécuté (T-008).

## T-000 — Tâche pilote (2026-11-12)

- Commit : `e627a96`.

- Initialise le dépôt git (branche `main`, aucun commit), ajoute `.gitignore` et `.gitattributes` (fins de ligne LF).
- Statut : validé.
