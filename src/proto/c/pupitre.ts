/**
 * Maquette C (jetable) : le pupitre au crayon. Mise en page (pixels CSS d'une scène 1280×720),
 * dessin fixe (cadres, quadrants des leviers, graduations de la jauge, lunette du tube, légende)
 * et dessin mobile (leviers, remplissage de la jauge, repère de la force demandée, voyant de
 * saturation). Tout en graphite ; le crayon rouge est réservé à la saturation.
 */
import {
  Crayon,
  ENCRE_TEXTE,
  GRAPHITE,
  HACHURE_ROUGE,
  TEXTE_ROUGE,
  TRAIT_APPUYE,
  TRAIT_CONTOUR,
  TRAIT_FIN,
  TRAIT_HACHURE,
  TRAIT_HACHURE_DENSE,
  TRAIT_ROUGE,
} from './crayon';

/** Tube : position et taille (pixels CSS). */
export const TUBE = { x: 254, y: 72, l: 772, h: 528 } as const;
/** Lunette autour du tube. */
const LUNETTE = { x: 236, y: 56, l: 808, h: 560 } as const;
/** Panneau de réglage (gauche) et panneau de force (droite). */
export const GAUCHE = { x: 14, y: 60, l: 210, h: 552 } as const;
export const DROITE = { x: 1056, y: 60, l: 210, h: 552 } as const;

/** Gain : bornes et pas du réglage (visuel). */
export const GAIN_MAX = 8000;
export const GAIN_PAS = 100;

/** Quadrant d'un levier : pivot, rayon de l'arc, débattement (rad de part et d'autre). */
export interface Quadrant {
  readonly px: number;
  readonly py: number;
  readonly r: number;
}
const DEBATTEMENT = (70 * Math.PI) / 180;
/** Haut des blocs Kp et Ki (le titre, le quadrant puis le champ). */
export const BLOC_KP = 92;
export const BLOC_KI = 286;
export function quadrant(haut: number): Quadrant {
  return { px: GAUCHE.x + 104, py: haut + 128, r: 70 };
}

/** Angle écran (rad, 0 = +x, sens horaire) d'une valeur de gain. */
export function angleDuGain(g: number): number {
  return -Math.PI / 2 - DEBATTEMENT + (2 * DEBATTEMENT * g) / GAIN_MAX;
}
/** Gain (non arrondi) pour un point écran autour du pivot. */
export function gainDuPoint(q: Quadrant, x: number, y: number): number {
  const a = Math.atan2(y - q.py, x - q.px);
  const f = (a + Math.PI / 2 + DEBATTEMENT) / (2 * DEBATTEMENT);
  return Math.min(1, Math.max(0, f)) * GAIN_MAX;
}

/** Jauge de force : colonne, ordonnées des repères (échelle réduite ÷4 au-dessus de Umax). */
export const JAUGE = { x: 1130, l: 42, yHaut: 168, y5000: 270, y0: 474, yBas: 560 } as const;
const K_JAUGE = (JAUGE.y0 - JAUGE.y5000) / 5000;
/** Ordonnée d'une force (N) sur la jauge (bornée à −2000 … 15 000 N). */
export function yJauge(f: number): number {
  const x = Math.min(15000, Math.max(-2000, f));
  if (x < 0) return JAUGE.y0 - x * ((JAUGE.yBas - JAUGE.y0) / 2000);
  if (x <= 5000) return JAUGE.y0 - x * K_JAUGE;
  return JAUGE.y5000 - ((x - 5000) / 10000) * (JAUGE.y5000 - JAUGE.yHaut);
}
/** Voyant de saturation (au-dessus de la jauge). */
export const VOYANT = { x: 1072, y: 98, l: 178, h: 36 } as const;

/** Dessin fixe du pupitre (après l'effacement du calque). */
export function dessinerFond(c: Crayon, niveau2: boolean): void {
  c.graine(1234);
  // Titre et bandeau.
  c.texte('Pupitre du treuil', 18, 38, 30);
  c.trait(16, 48, 300, 46, TRAIT_FIN);

  // Panneau de réglage.
  c.rect(GAUCHE.x, GAUCHE.y, GAUCHE.l, GAUCHE.h, TRAIT_CONTOUR);
  c.texte('RÉGLAGE DU GAIN', GAUCHE.x + GAUCHE.l / 2, GAUCHE.y + 24, 19, 'center');
  c.trait(GAUCHE.x + 18, GAUCHE.y + 30, GAUCHE.x + GAUCHE.l - 18, GAUCHE.y + 30, TRAIT_FIN);
  dessinerQuadrant(c, BLOC_KP, 'Kp', 'gain proportionnel');
  if (niveau2) {
    dessinerQuadrant(c, BLOC_KI, 'Ki', 'gain intégral');
  } else {
    const y = BLOC_KI + 40;
    c.hachures(GAUCHE.x + 14, y, GAUCHE.l - 28, 90, Math.PI / 4, 9, TRAIT_HACHURE);
    c.ctx.fillStyle = 'rgba(247,240,222,0.92)';
    c.ctx.fillRect(GAUCHE.x + 24, y + 14, GAUCHE.l - 48, 62);
    c.rect(GAUCHE.x + 14, y, GAUCHE.l - 28, 90, TRAIT_FIN);
    c.texte('Ki : sans objet', GAUCHE.x + GAUCHE.l / 2, y + 36, 19, 'center');
    c.texte('niveau 1 : contrôleur P seul', GAUCHE.x + GAUCHE.l / 2, y + 60, 15, 'center');
  }
  // Aide clavier.
  const ya = 548;
  c.trait(GAUCHE.x + 14, ya - 18, GAUCHE.x + GAUCHE.l - 14, ya - 18, TRAIT_HACHURE);
  c.texte('↑ ↓ ou + −  : ±100', GAUCHE.x + 14, ya, 15);
  c.texte('Pg↑ Pg↓  : ±1000', GAUCHE.x + 14, ya + 18, 15);
  c.texte(niveau2 ? 'Maj + flèche : Ki' : 'Tab : champ, levier', GAUCHE.x + 14, ya + 36, 15);
  c.texte('Entrée : Lancer', GAUCHE.x + 14, ya + 54, 15);

  // Lunette du tube : cadre double, hachures entre les deux, quatre vis.
  const L = LUNETTE;
  const ctx = c.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.x, L.y, L.l, L.h);
  ctx.rect(TUBE.x - 4, TUBE.y - 4, TUBE.l + 8, TUBE.h + 8);
  ctx.clip('evenodd');
  c.hachures(L.x, L.y, L.l, L.h, Math.PI / 4, 6, TRAIT_HACHURE);
  ctx.restore();
  c.rect(L.x, L.y, L.l, L.h, TRAIT_APPUYE);
  c.rect(TUBE.x - 4, TUBE.y - 4, TUBE.l + 8, TUBE.h + 8, TRAIT_CONTOUR);
  for (const [vx, vy] of [
    [L.x + 9, L.y + 8],
    [L.x + L.l - 9, L.y + 8],
    [L.x + 9, L.y + L.h - 8],
    [L.x + L.l - 9, L.y + L.h - 8],
  ] as const) {
    ctx.fillStyle = '#f7f0de';
    ctx.beginPath();
    ctx.arc(vx, vy, 6, 0, Math.PI * 2);
    ctx.fill();
    c.cercle(vx, vy, 5, TRAIT_FIN);
    c.trait(vx - 3.5, vy + 3, vx + 3.5, vy - 3, TRAIT_FIN);
  }
  // Plaque sous le tube.
  ctx.fillStyle = '#f7f0de';
  ctx.fillRect(L.x + L.l / 2 - 170, L.y + L.h - 13, 340, 22);
  c.rect(L.x + L.l / 2 - 170, L.y + L.h - 13, 340, 22, TRAIT_FIN);
  c.texte(
    'tube à phosphore vert · treuil et oscilloscope',
    L.x + L.l / 2,
    L.y + L.h + 4,
    15,
    'center',
  );

  // Panneau de force.
  c.rect(DROITE.x, DROITE.y, DROITE.l, DROITE.h, TRAIT_CONTOUR);
  c.texte('FORCE DU MOTEUR', DROITE.x + DROITE.l / 2, DROITE.y + 24, 19, 'center');
  c.trait(DROITE.x + 18, DROITE.y + 30, DROITE.x + DROITE.l - 18, DROITE.y + 30, TRAIT_FIN);
  dessinerEchelleJauge(c);

  // Bas de page : cadre de l'issue et légende.
  c.rect(14, 630, 470, 80, TRAIT_CONTOUR);
  c.texte('Issue', 26, 652, 18);
  c.texte('Légende', 500, 646, 17);
  c.trait(500, 650, 556, 650, TRAIT_FIN);
  c.texte('uSat : force appliquée par le moteur, bornée à ±Umax = 5000 N', 500, 668, 15);
  c.texte('uCmd : force demandée par le régulateur, avant la butée', 500, 686, 15);
  c.texte(
    niveau2 ? 'P = Kp·e et I = Ki·∫e dt : uCmd = P + I' : 'niveau 1 : uCmd = P = Kp·e',
    500,
    704,
    15,
  );
  c.texte('e = r − y : erreur (m) ; r : consigne', 920, 668, 15);
  c.texte('v : vitesse (m/s) ; a : accélération (m/s²)', 920, 686, 15);
}

/** Quadrant fixe d'un levier : arc, graduations tous les 1000, chiffres tous les 2000. */
function dessinerQuadrant(c: Crayon, haut: number, nom: string, sousTitre: string): void {
  const q = quadrant(haut);
  c.texte(nom, GAUCHE.x + 14, haut + 14, 22);
  c.texte(sousTitre, GAUCHE.x + 44, haut + 14, 15);
  c.arc(q.px, q.py, q.r, angleDuGain(0), angleDuGain(GAIN_MAX), TRAIT_CONTOUR);
  c.arc(q.px, q.py, q.r - 7, angleDuGain(0), angleDuGain(GAIN_MAX), TRAIT_HACHURE);
  for (let g = 0; g <= GAIN_MAX; g += 500) {
    const a = angleDuGain(g);
    const majeur = g % 1000 === 0;
    const r0 = q.r - (majeur ? 9 : 5);
    c.trait(
      q.px + Math.cos(a) * r0,
      q.py + Math.sin(a) * r0,
      q.px + Math.cos(a) * (q.r + (majeur ? 4 : 1)),
      q.py + Math.sin(a) * (q.r + (majeur ? 4 : 1)),
      majeur ? TRAIT_FIN : TRAIT_HACHURE,
    );
    if (g % 2000 === 0) {
      c.texte(
        String(g),
        q.px + Math.cos(a) * (q.r + 16),
        q.py + Math.sin(a) * (q.r + 16) + 5,
        14,
        'center',
      );
    }
  }
  // Socle du pivot.
  c.arc(q.px, q.py + 2, 16, Math.PI, Math.PI * 2, TRAIT_CONTOUR);
  c.trait(q.px - 20, q.py + 2, q.px + 20, q.py + 2, TRAIT_CONTOUR);
}

/** Échelle fixe de la jauge : colonne, graduations, rupture d'échelle, zone hors moteur. */
function dessinerEchelleJauge(c: Crayon): void {
  const J = JAUGE;
  // Zone au-delà de Umax : hachures légères (le moteur n'y va jamais).
  c.hachures(J.x, J.yHaut, J.l, J.y5000 - J.yHaut, -Math.PI / 4, 8, TRAIT_HACHURE);
  c.rect(J.x, J.yHaut, J.l, J.yBas - J.yHaut, TRAIT_CONTOUR);
  // Butée Umax : trait appuyé.
  c.trait(J.x - 10, J.y5000, J.x + J.l + 10, J.y5000, TRAIT_APPUYE);
  c.texte('Umax', J.x + J.l + 14, J.y5000 + 5, 16);
  // Rupture d'échelle (zigzag) juste au-dessus de la butée, sur les deux bords.
  for (const bx of [J.x, J.x + J.l]) {
    c.trait(bx - 6, J.y5000 - 10, bx + 6, J.y5000 - 15, TRAIT_FIN);
    c.trait(bx - 6, J.y5000 - 16, bx + 6, J.y5000 - 21, TRAIT_FIN);
  }
  // Zéro.
  c.trait(J.x - 10, J.y0, J.x + J.l + 6, J.y0, TRAIT_CONTOUR);
  // Graduations.
  for (let f = -2000; f <= 15000; f += 500) {
    if (f > 5000 && f % 2500 !== 0) continue;
    const y = yJauge(f);
    const majeur = f <= 5000 ? f % 1000 === 0 : f % 5000 === 0;
    c.trait(J.x - (majeur ? 9 : 5), y, J.x, y, majeur ? TRAIT_FIN : TRAIT_HACHURE);
    if (majeur) {
      const t =
        f === 0
          ? '0'
          : (f < 0 ? '−' : '') + String(Math.abs(f)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      c.texte(t, J.x - 12, y + 5, 14, 'right');
    }
  }
  c.texte('(N) échelle ÷4 au-dessus de Umax', DROITE.x + DROITE.l / 2, J.yHaut - 10, 14, 'center');
  c.texte('vers le bas', J.x + J.l + 6, J.yBas - 6, 14);
  // Voyant éteint.
  c.rect(VOYANT.x, VOYANT.y, VOYANT.l, VOYANT.h, TRAIT_CONTOUR);
}

/** État du dessin mobile (pour ne redessiner que si quelque chose change). */
export interface EtatMobile {
  kp: number;
  ki: number;
  niveau2: boolean;
  actif: boolean;
  uSat: number;
  uCmd: number;
  sature: boolean;
}

/** Dessin mobile : leviers, jauge, voyant. */
export function dessinerMobile(c: Crayon, e: Readonly<EtatMobile>): void {
  c.graine(99);
  dessinerLevier(c, quadrant(BLOC_KP), e.kp);
  if (e.niveau2) dessinerLevier(c, quadrant(BLOC_KI), e.ki);
  const J = JAUGE;
  // Remplissage : force appliquée, de 0 à uSat (vers le bas si négative).
  if (e.actif && Math.abs(e.uSat) > 1) {
    const ya = yJauge(e.uSat);
    const y0 = Math.min(ya, J.y0);
    const h = Math.abs(ya - J.y0);
    const style = e.sature ? HACHURE_ROUGE : TRAIT_HACHURE_DENSE;
    c.hachures(J.x + 4, y0, J.l - 8, h, Math.PI / 4, 4.5, style);
    c.hachures(J.x + 4, y0, J.l - 8, h, -Math.PI / 4, 9, style);
    c.rect(J.x + 4, y0, J.l - 8, h, e.sature ? TRAIT_ROUGE : TRAIT_CONTOUR);
  }
  // Force demandée : repère triangulaire à droite, trait qui traverse la colonne.
  if (e.actif) {
    const yc = yJauge(e.uCmd);
    const xr = J.x + J.l;
    const style = e.sature ? TRAIT_ROUGE : TRAIT_CONTOUR;
    c.trait(J.x - 2, yc, xr + 2, yc, style);
    c.trait(xr + 4, yc, xr + 18, yc - 8, style);
    c.trait(xr + 18, yc - 8, xr + 18, yc + 8, style);
    c.trait(xr + 18, yc + 8, xr + 4, yc, style);
    c.texte('uCmd', xr + 22, yc + 5, 15, 'left', e.sature ? TEXTE_ROUGE : ENCRE_TEXTE);
    // Dépassement écrêté : cote rouge entre Umax et la force demandée.
    if (e.sature) {
      const yu = yJauge(Math.sign(e.uCmd) * 5000);
      const xd = J.x + J.l / 2;
      if (Math.abs(yc - yu) > 6) {
        c.trait(xd, yu, xd, yc, TRAIT_ROUGE);
        const s = yc < yu ? 1 : -1;
        c.trait(xd, yc, xd - 4, yc + s * 8, TRAIT_ROUGE);
        c.trait(xd, yc, xd + 4, yc + s * 8, TRAIT_ROUGE);
      }
    }
  }
  // Voyant de saturation.
  const V = VOYANT;
  if (e.sature) {
    c.hachures(V.x + 3, V.y + 3, V.l - 6, V.h - 6, Math.PI / 4, 5, HACHURE_ROUGE);
    c.ctx.fillStyle = 'rgba(247,240,222,0.9)';
    c.ctx.fillRect(V.x + 18, V.y + 7, V.l - 36, V.h - 14);
    c.rect(V.x - 3, V.y - 3, V.l + 6, V.h + 6, TRAIT_ROUGE);
    c.texte('SATURATION', V.x + V.l / 2, V.y + 25, 22, 'center', TEXTE_ROUGE);
  } else {
    c.texte('saturation', V.x + V.l / 2, V.y + 24, 18, 'center', 'rgba(42,39,36,0.55)');
  }
}

/** Levier : tige du pivot vers le gain, boule hachurée au bout, pivot. */
function dessinerLevier(c: Crayon, q: Quadrant, g: number): void {
  const a = angleDuGain(g);
  const L = q.r - 14;
  const x = q.px + Math.cos(a) * L;
  const y = q.py + Math.sin(a) * L;
  c.trait(q.px, q.py, x, y, TRAIT_APPUYE);
  const ctx = c.ctx;
  ctx.fillStyle = '#f7f0de';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 8.5, 0, Math.PI * 2);
  ctx.clip();
  c.hachures(x - 9, y - 9, 18, 18, Math.PI / 4, 3, TRAIT_HACHURE_DENSE);
  ctx.restore();
  c.cercle(x, y, 9, TRAIT_CONTOUR);
  ctx.fillStyle = GRAPHITE;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(q.px, q.py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
