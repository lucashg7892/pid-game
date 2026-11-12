# Journal des modifications

À quoi sert cette page : retrouver ce que chaque tâche validée a apporté, avec ses réserves, et le commit qui la contient. Une entrée par tâche, la plus récente en premier (ordre des commits). Sources : `orchestration/REGISTRE.md`, `orchestration/logs/` et `git log --oneline`.

## Correspondance tâche → commit

Sortie de `git log --oneline 7bcd9ce` (11 commits, tous du 2026-11-12).

| Commit | Contenu |
|---|---|
| `7bcd9ce` | D-004 : documentation du noyau, de l'i18n et de la validation ; errata de la spec ; ADR-005 à 008 |
| `6259ccc` | T-007 : logique du niveau 1 et ses tests ; log T-007 |
| `c00e678` | registre : logs T-004b et T-006 |
| `1ee1010` | T-006 : i18n FR/EN |
| `bf7fd65` | licence MIT (`LICENSE`) et registre d'orchestration (T-000 à T-005) |
| `9569ca4` | T-005 : validation indépendante du noyau, rapport et scripts MATLAB |
| `1dc5f7e` | D-002 : documentation technique initiale |
| `beb6086` | T-003, T-004 et T-004b : noyau de simulation et ses tests (un seul commit pour les trois tâches) |
| `ff1bb60` | T-002 : socle outillé (`package.json` et `vitest.config.ts` y sont déjà dans leur état après T-003, avec `test:cov`) |
| `d57b05b` | T-001 : spécification |
| `e627a96` | T-000 : initialisation du dépôt |

Les neuf premiers commits ont été créés après coup, à la suite, à partir de l'état validé : leur ordre ne suit pas exactement l'ordre des validations (T-004b, validée après T-005, est dans `beb6086`). Depuis `6259ccc`, chaque tâche validée a son commit.

## D-004 — Documentation du noyau, de l'i18n et de la validation (2026-11-12)

- Ajoute [simulation.md](simulation.md), [physique/ascenseur.md](physique/ascenseur.md), [i18n-accessibilite.md](i18n-accessibilite.md), les [errata de la spec T-001](specs/T-001-errata.md) et les ADR-005 à ADR-008 ; met à jour `README.md`, `docs/README.md`, `architecture.md`, `developpement.md`, `tests.md` et ce journal.
- Vérification de l'orchestrateur : 14 SHA-256 identiques ; 76 liens relatifs, 0 cassé ; recalcul indépendant de e_ss, ζ, Mp et t_pic pour 1000, 2500 et 4000 N/m conforme.
- Commit : `7bcd9ce`.
- Statut : validé pour l'état `c00e678` (avant T-007). Points reportés à D-007 : mentions « Prévu (T-007) » dépassées ; tutoriel de lancement local ; titre provisoire ; dépôt GitHub.

## T-007 — Logique du niveau 1 (2026-11-12)

- Ajoute `src/game/` (7 fichiers : machine à états, arbitre des issues, marche du bonhomme, file d'événements, constantes) et `tests/game/` (6 fichiers de test, 62 tests, plus `helpers.ts`). Voir [jeu.md](jeu.md) et [ADR-009](decisions/ADR-009-machine-a-etats.md).
- Issues : `noLift` de 0 à 100 N/m, `step` de 200 à 1900, `win` de 2000 à 3800, `bonk` de 3900 à 8000 ; pas d'issue identiques à T-005 (2500 → 291, 3800 → 273, 3900 → 63).
- Vérification de l'orchestrateur : 14 SHA-256 identiques ; contre-épreuve par l'API publique en images irrégulières (8 à 40 ms) puis à 1/60 s, mêmes résultats (dont 2700 N/m → victoire au pas 289, non testé par l'agent) ; couverture `src/game` 100 % ; `npm run check` code 0 (231 tests, 28 modules sans violation).
- Commit : `6259ccc`.
- Statut : validé. Arbitrages et contrats :
  - D-a : le réglage ne produit que des multiples de 100 N/m ; `initialKp` sert aux tests hors grille (150 N/m) ;
  - D-b : `restart` revient au réglage (spec §6.6) ;
  - contrats pour T-008 à T-010 : instantané et événements réutilisés, à copier ; interpolation par `alpha` ; enregistreur de signaux avant chaque pas ; animations d'embarquement et de sortie laissées au rendu.
- Applique la recommandation D-11 de T-005 (issues à 3800 et 3900 N/m figées par un test).

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
