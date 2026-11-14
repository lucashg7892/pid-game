/**
 * Modèle de vue des écrans titre et menu (spec T-017 §4, §6) : textes exacts FR et EN, copyright,
 * entrées du menu d'après le catalogue.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/app';
import { CATALOGS, createTranslator, type Locale } from '../../src/i18n';
import {
  LEVEL_TITLE_KEYS,
  buildMenuView,
  buildTitleView,
  levelLabel,
} from '../../src/ui/screens-model';

const tr = (locale: Locale) => createTranslator(locale);

describe('écran titre', () => {
  it('textes français', () => {
    expect(buildTitleView(tr('fr'))).toEqual({
      locale: 'fr',
      title: 'Huygens’s world',
      tagline: 'Les bases de l’automatique, au crayon sur papier millimétré',
      play: 'Jouer',
      languageButton: 'English',
      languageDescription: 'Afficher le jeu en anglais',
      otherLocale: 'en',
      copyright: 'Copyright (c) 2026 lucashg7892',
      license: 'Licence MIT',
      announce: 'Écran titre',
    });
  });

  it('textes anglais', () => {
    expect(buildTitleView(tr('en'))).toEqual({
      locale: 'en',
      title: 'Huygens’s world',
      tagline: 'Control basics, in pencil on graph paper',
      play: 'Play',
      languageButton: 'Français',
      languageDescription: 'Show the game in French',
      otherLocale: 'fr',
      copyright: 'Copyright (c) 2026 lucashg7892',
      license: 'MIT License',
      announce: 'Title screen',
    });
  });

  it('suit la langue du traducteur après bascule', () => {
    const t = tr('fr');
    expect(buildTitleView(t).play).toBe('Jouer');
    t.setLocale('en');
    expect(buildTitleView(t).play).toBe('Play');
  });
});

describe('menu des niveaux', () => {
  it('une entrée par niveau du catalogue, titre par la clé du niveau', () => {
    const fr = buildMenuView(tr('fr'), LEVELS);
    expect(fr.entries).toEqual([
      { id: 'level1', label: 'Niveau 1 : le vide', playable: true },
      { id: 'level2', label: 'Niveau 2 : la mémoire', playable: true },
    ]);
    expect(fr.title).toBe('Niveaux');
    expect(fr.back).toBe('Retour');
    expect(fr.listLabel).toBe('Liste des niveaux');
    expect(fr.announce).toBe('Menu des niveaux');
    const en = buildMenuView(tr('en'), LEVELS);
    expect(en.entries[0]?.label).toBe('Level 1: The Gap');
    expect(en.entries[1]?.label).toBe('Level 2: Memory');
    expect(en.title).toBe('Levels');
    expect(en.back).toBe('Back');
  });

  it('liste autant d’entrées que le catalogue, dans son ordre, et garde « playable »', () => {
    const levels = [
      { id: 'level1', playable: true },
      { id: 'level1', playable: false },
      { id: 'inconnu', playable: true },
    ];
    const view = buildMenuView(tr('en'), levels);
    expect(view.entries.map((e) => e.playable)).toEqual([true, false, true]);
    expect(view.entries).toHaveLength(3);
  });

  it('un niveau sans clé garde son identifiant comme nom (pas d’exception)', () => {
    expect(levelLabel('inconnu', tr('fr'))).toBe('inconnu');
    expect(levelLabel('toString', tr('fr'))).toBe('toString');
  });

  it('chaque niveau du catalogue a une clé de titre existante dans les deux langues', () => {
    for (const level of LEVELS) {
      const key = LEVEL_TITLE_KEYS[level.id];
      expect(key, level.id).toBeDefined();
      if (key !== undefined) {
        expect(CATALOGS.fr[key].length).toBeGreaterThan(0);
        expect(CATALOGS.en[key].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('budget de clés des écrans', () => {
  it('title. et menu. : 8 clés dans chaque langue, mêmes clés', () => {
    const own = (l: Locale): string[] =>
      Object.keys(CATALOGS[l])
        .filter((k) => k.startsWith('title.') || k.startsWith('menu.'))
        .sort();
    expect(own('fr')).toHaveLength(8);
    expect(own('en')).toEqual(own('fr'));
  });
});
