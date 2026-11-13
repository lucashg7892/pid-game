/**
 * Matériau du trait de crayon (T-009) : nœuds TSL, un seul code compilé en WGSL (WebGPU) et en
 * GLSL (WebGL2).
 *
 * Opacité = opacité du crayon × encre du sommet × couverture du bord × grain.
 * - Couverture du bord (anti-crénelage analytique) : la coordonnée transversale `stroke.x` vaut
 *   −1 et +1 sur les bords du ruban, qui est élargi d'un pixel par le peintre
 *   (`STROKE_FRINGE_PX`) ; `fwidth` donne sa variation par pixel, d'où une rampe d'un pixel
 *   vers la transparence sur chaque bord. Pas de MSAA : coût nul en mémoire, même rendu sur les
 *   deux backends, et les traits plus fins qu'un pixel sont épaissis côté CPU
 *   (`MIN_STROKE_PX`) au lieu de clignoter.
 * - Opacité perçue : WebGPURenderer mélange dans une cible linéaire ; un gris foncé à 85 %
 *   d'opacité y paraît bien plus pâle qu'au crayon (85 % en sRGB). L'opacité voulue a (mélange
 *   sRGB sur le papier) est donc convertie en opacité linéaire
 *   a' = (P^γ − (P + (C − P)·a)^γ) / (P^γ − C^γ), avec P et C les moyennes sRGB du papier et de
 *   la mine, γ = `PERCEPTUAL_GAMMA` : sur le papier, le trait a la teinte d'un mélange sRGB.
 * - Grain du graphite : bruit blanc par cellule monde (`PENCIL_GRAIN_CELL`), procédural
 *   (hachage PCG de three), aucune texture ni image.
 */
import { DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';
import {
  abs,
  attribute,
  clamp,
  color,
  float,
  floor,
  fwidth,
  hash,
  max,
  positionWorld,
  pow,
} from 'three/tsl';
import { PAPER_COLOR } from './paper';
import { PENCIL_GRAIN_CELL, PENCIL_GRAIN_STRENGTH, PERCEPTUAL_GAMMA } from './pencil-style';

/** Nom de l'attribut de sommet (transversale, encre) écrit par `StrokeBatch`. */
export const STROKE_ATTRIBUTE = 'stroke';

/** Décalage et pas de ligne du hachage du grain (graine < 2^24, exacte en flottant 32 bits). */
const GRAIN_INDEX_OFFSET = 2048;
const GRAIN_ROW_STRIDE = 4096;

/**
 * Moyenne des trois composantes d'une couleur `#rrggbb`, dans [0, 1] (sRGB).
 * @param hex couleur.
 */
function channelMean(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return (((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255)) / 3 / 255;
}

/**
 * Crée un matériau de crayon.
 * @param hex teinte (sRGB, p. ex. `#3a3a3a`).
 * @param opacity opacité de base dans [0, 1].
 * @param name nom (débogage).
 */
export function createPencilMaterial(
  hex: string,
  opacity: number,
  name: string,
): MeshBasicNodeMaterial {
  const stroke = attribute(STROKE_ATTRIBUTE, 'vec2');
  const across = stroke.x;
  const ink = stroke.y;
  const coverage = clamp(
    float(1)
      .sub(abs(across))
      .div(max(fwidth(across), 1e-4)),
    0,
    1,
  );
  const cell = clamp(
    floor(positionWorld.xy.div(PENCIL_GRAIN_CELL)),
    -(GRAIN_INDEX_OFFSET - 1),
    GRAIN_INDEX_OFFSET - 1,
  ).add(GRAIN_INDEX_OFFSET);
  const grain = float(1).sub(
    hash(cell.x.add(cell.y.mul(GRAIN_ROW_STRIDE))).mul(PENCIL_GRAIN_STRENGTH),
  );

  const alpha = coverage.mul(ink).mul(grain).mul(opacity);
  const paper = channelMean(PAPER_COLOR);
  const lead = channelMean(hex);
  const paperLinear = paper ** PERCEPTUAL_GAMMA;
  const leadLinear = lead ** PERCEPTUAL_GAMMA;
  const blended = float(paper).add(alpha.mul(lead - paper));
  const linearAlpha = clamp(
    float(paperLinear)
      .sub(pow(blended, PERCEPTUAL_GAMMA))
      .div(paperLinear - leadLinear),
    0,
    1,
  );

  const material = new MeshBasicNodeMaterial();
  material.colorNode = color(hex);
  material.opacityNode = linearAlpha;
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  // Rubans d'orientation quelconque : pas d'élimination des faces. Une seule passe : sans
  // `forceSinglePass`, three dessine deux fois un objet transparent DoubleSide (faces arrière
  // puis avant), soit deux appels de dessin par lot.
  material.side = DoubleSide;
  material.forceSinglePass = true;
  material.name = name;
  return material;
}
