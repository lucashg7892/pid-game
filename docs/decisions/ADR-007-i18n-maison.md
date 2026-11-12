# ADR-007 — i18n maison typée, sans bibliothèque

## Contexte

Le jeu est en français et en anglais, textes externalisés dès le départ (décision D3). Le besoin est petit : 89 clés, deux langues, une interpolation `{nom}`, le formatage des nombres. Le module doit rester pur (règle `i18n-is-pure`) et testable sous Node.

## Décision

- Module `src/i18n` écrit pour le projet, sans dépendance externe (T-006).
- Catalogues JSON plats ; type des clés dérivé de `fr.json` ; catalogue anglais typé contre le français.
- Table `MESSAGE_PARAMS` qui type les paramètres de chaque clé ; interpolation stricte (`I18nError` sur paramètre manquant ou en trop).
- Nombres et unités par `Intl.NumberFormat`, fourni par le navigateur et par Node.

## Alternatives écartées

| Option | Raison |
|---|---|
| bibliothèque i18n du marché | dépendance et poids ajoutés pour un besoin couvert par 522 lignes de TypeScript (`wc -l src/i18n/*.ts`) ; typage des paramètres moins strict ; aucune bibliothèque n'était spécifiée par la spec T-001 §8 |
| textes en dur dans le code | contraire à D3 |

## Conséquences

- Une clé absente ou un paramètre mal nommé est refusé à la compilation (`npm run typecheck`).
- La typographie FR/EN est vérifiée par des tests (`tests/i18n/catalogs.test.ts`).
- Ajouter une troisième langue demande de revoir `otherLocale` et quelques règles codées pour deux langues (voir [i18n-accessibilite.md](../i18n-accessibilite.md#ajouter-une-langue)).
- Pas de pluriels ni de genres gérés : aucun texte actuel n'en a besoin.

## Statut

Accepté (T-006 ; 2026-11-12).
