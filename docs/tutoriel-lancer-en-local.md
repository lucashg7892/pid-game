# Tutoriel : lancer le projet sur son PC (Windows)

À quoi sert cette page : guider pas à pas, sous Windows et dans PowerShell, l'installation d'une copie du projet, son lancement dans le navigateur, les tests et la validation MATLAB. Aucune connaissance en développement n'est supposée. État décrit : commit `7bcd9ce` (2026-11-12).

> **Statut des commandes.** Les commandes `git`, `npm` et `vite` de ce tutoriel ont été exécutées sous Linux (machine virtuelle du projet), pas sous Windows. Elles sont marquées « non exécuté sous Windows ». La validation MATLAB (étape 7) a été exécutée sous Windows.

## Avant de commencer : travaillez dans une copie

**Ne lancez aucune commande `npm` dans le dossier `PID_GAME` lui-même.** Travaillez dans une copie, par exemple `pid-game-test`.

Pourquoi : les agents de développement du projet utilisent le dossier `node_modules` de `PID_GAME`. Il a été installé pour Linux et contient des programmes compilés pour Linux (par exemple `@rolldown/binding-linux-x64-gnu`, utilisé par Vite). Un `npm ci` lancé sous Windows dans `PID_GAME` remplacerait ces programmes par leur version Windows : les contrôles des agents ne fonctionneraient plus. L'inverse est vrai aussi : le `node_modules` de `PID_GAME` ne fonctionne pas sous Windows.

## 1. Vérifier les prérequis

Il vous faut deux logiciels.

| Logiciel | Version | Où le trouver |
|---|---|---|
| Node.js | 22.12.0 ou plus récent | version LTS sur [nodejs.org](https://nodejs.org) ; npm est installé avec |
| git | toute version récente | [git-scm.com](https://git-scm.com) |

Ouvrez PowerShell (menu Démarrer, tapez « PowerShell ») et tapez :

```powershell
node -v
git --version
```

`node -v` doit afficher `v22.12.0` ou un numéro plus grand (par exemple `v22.23.4`, ou `v24.…`). Si le numéro commence par `v22.` mais est inférieur à `v22.12`, ou s'il commence par `v20`, installez la version LTS. Le minimum vient de `package.json` (`"node": ">=22.12.0"`) : Vitest 5.1.0 l'exige.

## 2. Créer la copie

Placez-vous dans le dossier qui contient `PID_GAME` (remplacez `<vous>` par votre nom d'utilisateur Windows) :

```powershell
cd "C:\Users\<vous>\Documents\GitHub"
git clone PID_GAME pid-game-test
cd pid-game-test
npm ci
```

- `git clone PID_GAME pid-game-test` copie le dépôt local, avec tous ses commits, y compris ceux qui n'ont pas encore été envoyés sur GitHub. Il ne copie pas les fichiers modifiés mais non encore enregistrés dans un commit.
- `npm ci` installe exactement les versions de `package-lock.json` dans `pid-game-test\node_modules`. Comptez de quelques secondes à quelques minutes selon la connexion (4 s sous Linux avec un cache déjà rempli). Il peut afficher un message sur des vulnérabilités « moderate » : elles concernent les outils de développement (réserve E7 de T-002), pas le jeu.

Non exécuté sous Windows. Sous Linux : `git clone` d'un dépôt local → code 0, dernier commit `7bcd9ce` ; `npm ci` → code 0.

**Variante** : cloner depuis GitHub.

```powershell
cd "C:\Users\<vous>\Documents\GitHub"
git clone https://github.com/lucashg7892/pid-game.git pid-game-test
cd pid-game-test
npm ci
```

Le dépôt GitHub est privé pour l'instant : git vous demandera de vous connecter à votre compte. Cette copie ne contient que ce qui a été poussé sur GitHub, pas forcément les derniers commits de `PID_GAME`. Non exécuté.

## 3. Lancer le site

```powershell
npm run dev
```

Vite affiche quelques lignes, dont l'adresse à ouvrir :

```text
  VITE v8.3.8  ready in 687 ms

  ➜  Local:   http://localhost:5173/pid-game/
```

Ouvrez cette adresse dans votre navigateur. Le chemin `/pid-game/` vient de `base: '/pid-game/'` dans `vite.config.ts` (nom du futur site GitHub Pages). Le port est celui affiché par Vite : 5173 par défaut.

**Ce que vous verrez au 2026-11-12 : une page blanche.** C'est normal : aucun rendu n'existe avant la tâche T-008. Le titre de l'onglet est « PID Game ».

Pour arrêter le serveur : revenez dans PowerShell et tapez `Ctrl+C` (confirmez par `O` ou `Y` si Windows le demande).

Non exécuté sous Windows. Sous Linux : sortie ci-dessus, recopiée telle quelle.

## 4. Mettre à jour la copie

Quand le projet a avancé, depuis `pid-game-test` :

```powershell
git pull
```

Avec une copie faite par `git clone PID_GAME`, `git pull` récupère les nouveaux commits de `PID_GAME` (pas ceux de GitHub).

Relancez `npm ci` **seulement si** `package.json` ou `package-lock.json` ont changé. Pour le savoir, juste après `git pull` :

```powershell
git diff --stat "HEAD@{1}" HEAD -- package.json package-lock.json
```

Si la commande n'affiche rien, ces fichiers n'ont pas changé. Non exécuté sous Windows.

## 5. Ce qui est utile aujourd'hui

Le jeu ne s'affiche pas encore, mais vous pouvez vérifier le travail fait.

| Commande | Durée indicative | Ce qu'elle montre |
|---|---|---|
| `npm run test` | ≈ 15 à 20 s | les 231 tests unitaires (21 fichiers) au commit `7bcd9ce` ; la fin doit afficher `Test Files 21 passed (21)` et `Tests 231 passed (231)`. Les lignes `T1`, `REF`, `EXACT` comparent la simulation aux formules et à la solution exacte |
| `npm run test:cov` | ≈ 25 s | les mêmes tests, puis un tableau de couverture de `src/sim` : 100 % partout. Échoue sous 95 % des lignes |
| `npm run check` | ≈ 1 à 2 min | toute la chaîne : vérification des types, lint, formatage, règles d'architecture, tests, construction du site dans `dist\`. Doit se terminer sans erreur |

Durées mesurées sous Linux ; non exécuté sous Windows. Détail des tests : [tests.md](tests.md).

## 6. Relancer la validation MATLAB

La validation indépendante du noyau (tâche T-005) compare la simulation à un calcul exact fait dans MATLAB. MATLAB sert uniquement à cette vérification : rien de MATLAB n'est dans le site.

1. Ouvrez MATLAB (R2025a ; aucune toolbox nécessaire).
2. Placez le dossier courant de MATLAB sur la racine du dépôt (`pid-game-test`, ou `PID_GAME` : les scripts ne font que lire). Par exemple, dans la fenêtre de commande :

```matlab
cd('C:\Users\<vous>\Documents\GitHub\pid-game-test')
run('validation/matlab/t005_run_all.m')
```

3. MATLAB affiche cinq blocs (A + B, C, D, E) : écarts entre la simulation et le calcul exact, effet du bloqueur d'ordre zéro, limite de stabilité (97078,6 N/m à dt = 1/120 s), fenêtre de réussite [2000 ; 3800] N/m et marges à la poutre (+5,842 mm à 3800, −1,865 mm à 3900).
4. La dernière ligne doit être :

```text
T005 : FIN SANS ERREUR
```

Exécuté sous Windows le 2026-11-12 dans `PID_GAME` : MATLAB 25.1 (R2025a), « T005 : FIN SANS ERREUR », 1,1 s. Mode d'emploi complet : [validation/README.md](../validation/README.md).

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `npm ci` refuse de s'installer, ou une erreur parle de `engine` ou de version de Node | Node trop ancien | installer Node LTS (≥ 22.12) puis vérifier `node -v` |
| `Cannot find module '@rolldown/binding-win32-x64-msvc'` ou erreur de « native binding » au lancement de `npm run dev` | le dossier `node_modules` a été copié depuis un autre système (Linux) | supprimer `node_modules`, puis refaire `npm ci` (voir ci-dessous) |
| Vite affiche une autre adresse que `5173`, ou `Port 5173 is in use` | un autre programme (souvent un ancien `npm run dev`) utilise déjà le port | ouvrir l'adresse affichée par Vite, ou fermer l'autre fenêtre PowerShell |
| `npm run e2e` échoue (« No tests found » ou erreur sur `tests/smoke.test.ts`) | les tests de bout en bout n'existent pas encore | **ne pas lancer `npm run e2e` avant la tâche T-010** |
| page blanche sur `http://localhost:5173/pid-game/` | normal au 2026-11-12 | rien à faire : le rendu arrive avec T-008 |

Supprimer `node_modules` et réinstaller (depuis `pid-game-test`, jamais dans `PID_GAME`) :

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

Non exécuté sous Windows. Le nom exact du message d'erreur de Rolldown n'a pas été reproduit : le paquet attendu sous Windows x64 est `@rolldown/binding-win32-x64-msvc` (listé dans `package-lock.json`).

Pour aller plus loin : [developpement.md](developpement.md) (scripts, conventions) et [README.md](README.md) (index de la documentation).
