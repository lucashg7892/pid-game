/**
 * Maquette C (jetable) : l'oscilloscope dessiné sur le phosphore du tube. Une voie par grandeur
 * (erreur, commande, termes P et I au niveau 2, vitesse, accélération), balayage de gauche à
 * droite sur toute la durée du trajet, graticule, graduations et unités, valeur courante de
 * chaque trace. Échelles fixées au chargement du trajet (bornes « jolies » de ses données).
 */
import type { Echantillon, TrajetReference } from '../common/types';
import type { Cadre } from './treuil';

const POLICE_TUBE = "'Consolas', 'Lucida Console', 'Courier New', monospace";
const VERT_TEXTE = '#b8ffc4';
const GRILLE = '#3cff78';

/** Grandeur d'un échantillon que l'on peut tracer. */
type Grandeur = 'e' | 'uCmd' | 'uSat' | 'p' | 'i' | 'v' | 'a';

/** Une trace d'une voie. */
interface Trace {
  readonly grandeur: Grandeur;
  readonly nom: string;
  readonly couleur: string;
  readonly largeur: number;
  /** Pointillé du tracé ([] : plein). */
  readonly tirets: readonly number[];
  /** Nombre de décimales de la valeur affichée. */
  readonly decimales: number;
}

/** Une voie (une bande horizontale, son échelle, ses traces). */
interface Voie {
  readonly titre: string;
  readonly unite: string;
  readonly traces: readonly Trace[];
  readonly poids: number;
  /** Bornes et pas des graduations (calculés au chargement). */
  bas: number;
  haut: number;
  pas: number;
  /** Lignes ±Umax (voie commande seulement). */
  readonly umax: boolean;
  /** Position (pixels du tube), calculée au chargement. */
  y0: number;
  y1: number;
  /** Étiquettes des graduations (préparées au chargement). */
  etiquettes: { readonly v: number; readonly texte: string }[];
}

const T_E: Trace = {
  grandeur: 'e',
  nom: 'e',
  couleur: '#8dff8a',
  largeur: 2,
  tirets: [],
  decimales: 2,
};
const T_USAT: Trace = {
  grandeur: 'uSat',
  nom: 'uSat',
  couleur: '#5dffc8',
  largeur: 2.4,
  tirets: [],
  decimales: 0,
};
const T_UCMD: Trace = {
  grandeur: 'uCmd',
  nom: 'uCmd',
  couleur: '#e6ff6e',
  largeur: 1.6,
  tirets: [7, 5],
  decimales: 0,
};
const T_P: Trace = {
  grandeur: 'p',
  nom: 'P',
  couleur: '#8dff8a',
  largeur: 2,
  tirets: [],
  decimales: 0,
};
const T_I: Trace = {
  grandeur: 'i',
  nom: 'I',
  couleur: '#e6ff6e',
  largeur: 2.2,
  tirets: [2, 4],
  decimales: 0,
};
const T_V: Trace = {
  grandeur: 'v',
  nom: 'v',
  couleur: '#8dff8a',
  largeur: 2,
  tirets: [],
  decimales: 2,
};
const T_A: Trace = {
  grandeur: 'a',
  nom: 'a',
  couleur: '#5dffc8',
  largeur: 2,
  tirets: [],
  decimales: 1,
};

function voie(
  titre: string,
  unite: string,
  traces: readonly Trace[],
  poids: number,
  umax = false,
): Voie {
  return {
    titre,
    unite,
    traces,
    poids,
    umax,
    bas: 0,
    haut: 1,
    pas: 1,
    y0: 0,
    y1: 0,
    etiquettes: [],
  };
}

/** Nombre à la française (virgule décimale, espace fine des milliers au-delà de 9 999). */
export function nombre(x: number, decimales: number): string {
  const s = Math.abs(x) < 0.5 * 10 ** -decimales ? (0).toFixed(decimales) : x.toFixed(decimales);
  const [entier = '', frac] = s.split('.');
  const signe = entier.startsWith('-') ? '−' : '';
  const chiffres = entier.replace('-', '');
  const groupe = chiffres.length > 4 ? chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : chiffres;
  return signe + groupe + (frac === undefined ? '' : ',' + frac);
}

/** Pas « joli » (1, 2, 2,5 ou 5 × 10^k) pour couvrir `etendue` en 2 à 4 intervalles. */
function pasJoli(etendue: number): number {
  const brut = etendue / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= brut) return m * p;
  return 10 * p;
}

function decimalesDuPas(pas: number): number {
  for (let d = 0; d < 3; d++) {
    const x = pas * 10 ** d;
    if (Math.abs(x - Math.round(x)) < 1e-9) return d;
  }
  return 3;
}

export class Oscillo {
  private voies: Voie[] = [];
  private tMax = 1;
  private pasT = 0.5;
  private etiquettesT: { readonly t: number; readonly texte: string }[] = [];
  private uMax = 5000;
  private x0 = 0;
  private x1 = 0;
  private trajet: TrajetReference | null = null;

  /** Prépare les voies, les échelles et les étiquettes d'un trajet dans le cadre donné. */
  charger(trajet: TrajetReference, cadre: Cadre): void {
    this.trajet = trajet;
    this.uMax = trajet.physique.uMax;
    const n2 = trajet.niveau === 'level2';
    this.voies = n2
      ? [
          voie('erreur e', 'm', [T_E], 1),
          voie('commande u', 'N', [T_USAT, T_UCMD], 1.25, true),
          voie('termes P et I', 'N', [T_P, T_I], 1.1),
          voie('vitesse v', 'm/s', [T_V], 1),
          voie('accélération a', 'm/s²', [T_A], 1),
        ]
      : [
          voie('erreur e', 'm', [T_E], 1),
          voie('commande u (P seul)', 'N', [T_USAT, T_UCMD], 1.5, true),
          voie('vitesse v', 'm/s', [T_V], 1),
          voie('accélération a', 'm/s²', [T_A], 1),
        ];
    const duree = (trajet.echantillons.length - 1) * trajet.dt;
    this.pasT = duree <= 2 ? 0.25 : 0.5;
    this.tMax = Math.max(this.pasT, Math.ceil(duree / this.pasT - 1e-9) * this.pasT);
    this.etiquettesT = [];
    for (let t = 0; t <= this.tMax + 1e-9; t += this.pasT) {
      this.etiquettesT.push({ t, texte: nombre(t, this.pasT < 0.5 ? 2 : 1) });
    }
    this.x0 = cadre.x + 66;
    this.x1 = cadre.x + cadre.l - 8;
    const haut = cadre.y + 4;
    const bas = cadre.y + cadre.h - 30;
    const ecart = 9;
    const total = this.voies.reduce((s, v) => s + v.poids, 0);
    const utile = bas - haut - ecart * (this.voies.length - 1);
    let y = haut;
    for (const v of this.voies) {
      const hauteur = (utile * v.poids) / total;
      v.y0 = y;
      v.y1 = y + hauteur;
      y += hauteur + ecart;
      let mn = 0;
      let mx = 0;
      for (const ech of trajet.echantillons) {
        for (const tr of v.traces) {
          const x = ech[tr.grandeur];
          if (x < mn) mn = x;
          if (x > mx) mx = x;
        }
      }
      if (v.umax) {
        mx = Math.max(mx, this.uMax);
        mn = Math.min(mn, -0.2 * this.uMax);
      }
      if (mx - mn < 1e-6) mx = mn + 1;
      const pas = pasJoli(mx - mn);
      v.pas = pas;
      v.bas = Math.floor(mn / pas - 1e-9) * pas;
      v.haut = Math.ceil(mx / pas - 1e-9) * pas;
      const dec = decimalesDuPas(pas);
      v.etiquettes = [];
      for (let g = v.bas; g <= v.haut + pas * 1e-6; g += pas) {
        v.etiquettes.push({ v: g, texte: nombre(g, dec) });
      }
    }
  }

  private xDe(t: number): number {
    return this.x0 + ((this.x1 - this.x0) * t) / this.tMax;
  }

  private yDe(v: Voie, x: number): number {
    return v.y1 - ((v.y1 - v.y0) * (x - v.bas)) / (v.haut - v.bas);
  }

  /**
   * Dessine le graticule et les traces jusqu'à l'indice `indice`, puis jusqu'à l'échantillon
   * interpolé `courant` (tête du faisceau). `actif` faux : graticule seul (en attente).
   */
  dessiner(
    ctx: CanvasRenderingContext2D,
    indice: number,
    courant: Readonly<Echantillon>,
    actif: boolean,
  ): void {
    const trajet = this.trajet;
    if (trajet === null) return;
    const ech = trajet.echantillons;
    const x0 = this.x0;
    const x1 = this.x1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'middle';
    ctx.font = `12px ${POLICE_TUBE}`;

    // Graticule vertical commun (secondes) et étiquettes du temps.
    const yHaut = this.voies[0]?.y0 ?? 0;
    const yBas = this.voies[this.voies.length - 1]?.y1 ?? 0;
    ctx.beginPath();
    for (const g of this.etiquettesT) {
      const x = this.xDe(g.t);
      ctx.moveTo(x, yHaut);
      ctx.lineTo(x, yBas + 4);
    }
    ctx.strokeStyle = GRILLE;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = VERT_TEXTE;
    ctx.textAlign = 'center';
    for (const g of this.etiquettesT) ctx.fillText(g.texte, this.xDe(g.t), yBas + 14);
    ctx.textAlign = 'left';
    ctx.fillText('t (s)', x0 - 60, yBas + 14);

    for (const v of this.voies) {
      // Cadre et graduations de la voie.
      ctx.beginPath();
      ctx.rect(x0, v.y0, x1 - x0, v.y1 - v.y0);
      ctx.strokeStyle = GRILLE;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      for (const g of v.etiquettes) {
        const y = this.yDe(v, g.v);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.globalAlpha = 0.14;
      ctx.stroke();
      // Zéro plus marqué.
      if (v.bas < 0 && v.haut > 0) {
        const y = this.yDe(v, 0);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.globalAlpha = 0.4;
        ctx.stroke();
      }
      if (v.umax) {
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        const y = this.yDe(v, this.uMax);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        if (v.bas <= -this.uMax) {
          const y2 = this.yDe(v, -this.uMax);
          ctx.moveTo(x0, y2);
          ctx.lineTo(x1, y2);
        }
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.textAlign = 'right';
        ctx.fillText('Umax', x1 - 4, y - 8);
      }
      // Étiquettes de l'échelle (à gauche du cadre).
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = VERT_TEXTE;
      ctx.textAlign = 'right';
      for (const g of v.etiquettes) {
        const y = this.yDe(v, g.v);
        ctx.fillText(g.texte, x0 - 5, Math.min(v.y1 - 5, Math.max(v.y0 + 5, y)));
      }
      // Titre de la voie et unité, en haut à gauche dans le cadre.
      ctx.textAlign = 'left';
      ctx.font = `13px ${POLICE_TUBE}`;
      ctx.fillText(`${v.titre} (${v.unite})`, x0 + 6, v.y0 + 10);
      ctx.font = `12px ${POLICE_TUBE}`;

      // Traces jusqu'à l'instant courant.
      if (actif) {
        for (const tr of v.traces) {
          const g = tr.grandeur;
          ctx.beginPath();
          for (let j = 0; j <= indice && j < ech.length; j++) {
            const s = ech[j] as Echantillon;
            const x = this.xDe(s.t);
            const y = this.yDe(v, s[g]);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          const xc = this.xDe(courant.t);
          const yc = this.yDe(v, courant[g]);
          ctx.lineTo(xc, yc);
          ctx.setLineDash(tr.tirets as number[]);
          ctx.strokeStyle = tr.couleur;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = tr.largeur;
          ctx.stroke();
          ctx.setLineDash([]);
          // Tête du faisceau : point vif.
          ctx.beginPath();
          ctx.arc(xc, yc, tr.largeur + 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#eaffee';
          ctx.globalAlpha = 1;
          ctx.fill();
        }
      }
      // Légende et valeurs courantes, en haut à droite.
      ctx.textAlign = 'right';
      let xl = x1 - 6;
      for (let k = v.traces.length - 1; k >= 0; k--) {
        const tr = v.traces[k] as Trace;
        const val = actif ? `${tr.nom} ${nombre(courant[tr.grandeur], tr.decimales)}` : tr.nom;
        ctx.globalAlpha = 1;
        ctx.fillStyle = tr.couleur;
        ctx.fillText(val, xl, v.y0 + 10);
        const larg = ctx.measureText(val).width;
        // Échantillon du style de la trace, à gauche du texte.
        ctx.beginPath();
        ctx.moveTo(xl - larg - 26, v.y0 + 10);
        ctx.lineTo(xl - larg - 6, v.y0 + 10);
        ctx.setLineDash(tr.tirets as number[]);
        ctx.strokeStyle = tr.couleur;
        ctx.lineWidth = tr.largeur;
        ctx.stroke();
        ctx.setLineDash([]);
        xl -= larg + 40;
      }
    }

    // Ligne du balayage à l'instant courant.
    if (actif) {
      const x = this.xDe(courant.t);
      ctx.beginPath();
      ctx.moveTo(x, yHaut);
      ctx.lineTo(x, yBas);
      ctx.strokeStyle = GRILLE;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = VERT_TEXTE;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Abscisse et ordonnée utiles pour poser un message au centre de la zone des courbes. */
  centre(): { readonly x: number; readonly y: number } {
    const yHaut = this.voies[0]?.y0 ?? 0;
    const yBas = this.voies[this.voies.length - 1]?.y1 ?? 0;
    return { x: (this.x0 + this.x1) / 2, y: (yHaut + yBas) / 2 };
  }
}
