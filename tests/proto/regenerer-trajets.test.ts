/**
 * Régénération de `src/proto/common/trajets.ts`, DÉSACTIVÉE par défaut : ne s'exécute que si la
 * variable d'environnement REGENERER_TRAJETS vaut 1 (commande exacte dans l'en-tête du fichier
 * généré). Simule les trois trajets par le vrai jeu, écrit le module et le formate par Prettier.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';
import { REGLAGES, moduleTrajets, simulerTrajet } from './simuler';

const ACTIF = process.env.REGENERER_TRAJETS === '1';
const CIBLE = resolve(import.meta.dirname, '../../src/proto/common/trajets.ts');

describe('régénération des trajets de référence', () => {
  it.skipIf(!ACTIF)('écrit src/proto/common/trajets.ts', async () => {
    const trajets = REGLAGES.map(simulerTrajet);
    const options = (await resolveConfig(CIBLE)) ?? {};
    const texte = await format(moduleTrajets(trajets), { ...options, filepath: CIBLE });
    writeFileSync(CIBLE, texte, 'utf8');
    for (const { meta, colonnes } of trajets) {
      const sat = colonnes.saturated.slice(0, meta.pasIssue).filter((s) => s === 1).length;
      const picCmd = Math.max(...colonnes.uCmd.map(Math.abs));
      const picI = Math.max(...colonnes.i);
      console.info(
        `${meta.id} : ${meta.niveau} Kp=${String(meta.kp)} Ki=${String(meta.ki)} issue=${meta.issue} pas=${String(meta.pasIssue)} échantillons=${String(colonnes.y.length)} saturés=${String(sat)} pic|uCmd|=${String(picCmd)} picI=${String(picI)}`,
      );
    }
    expect(trajets).toHaveLength(3);
  });
});
