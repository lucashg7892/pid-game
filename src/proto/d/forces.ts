/**
 * Maquette D (lot B, v0.3, JETABLE) : colonne « D'où vient la force ? ». Le calcul du régleur
 * écrit à la main avec les valeurs de l'instant : l'écart e, le ressort P (raideur Kp, étiré
 * de e), le bocal I (il accumule l'écart au fil du temps), une note qui explique la situation,
 * l'addition des deux vecteurs sur une règle des forces où le moteur bute à Umax (l'excès écrêté
 * se voit), puis la cabine isolée avec son bilan des forces et son accélération.
 */
import type { EtatRejeu } from '../contrat';
import type { TrajetReference } from '../common/types';
import { Crayon, ENCRE, ENCRE_PALE, GRAPHITE, ROUGE, ROUGE_TEXTE } from './crayon';
import { nb } from './format';

/** Bord gauche des textes de la colonne. */
const X = 414;
/** Ressort P : mur d'accroche (x), ordonnée, longueur au repos et par mètre d'écart (px). */
const RESSORT_X = 700;
const RESSORT_Y = 160;
const RESSORT_REPOS = 22;
const RESSORT_PAR_M = 36;
/** Bocal I : position, taille, contenance pleine (m·s). */
const BOCAL_X = 774;
const BOCAL_Y = 200;
const BOCAL_L = 42;
const BOCAL_H = 60;
const BOCAL_PLEIN = 1;
/** Note d'explication (« Nota »). */
const NOTA_Y = 270;
const NOTA_H = 50;
/** Règle des forces : abscisse du zéro, échelle (px par N), bornes (N). */
const REGLE_ZERO = 470;
const REGLE_ECHELLE = 0.0238;
const REGLE_MIN = -2000;
const REGLE_MAX = 15000;
const RANG_P = 386;
const RANG_I = 410;
const RANG_DEMANDE = 434;
const RANG_MOTEUR = 458;
const REGLE_Y = 476;
const BUTEE_HAUT = 364;
/** Colonne des valeurs, à droite de la butée. */
const VALEURS_X = 612;
/** Cabine isolée : centre et échelle des flèches (px par N). */
const ISOLEE_X = 470;
const ISOLEE_Y = 572;
/**
 * Longueur d'une flèche de la cabine isolée (px) : croissante avec la force mais PAS à l'échelle
 * (racine carrée), pour que le poids (491 N) reste visible à côté de 5 000 N.
 */
function longueurIsolee(force: number, uMax: number): number {
  const l = 6 + 30 * Math.sqrt(Math.abs(force) / uMax);
  return Math.sign(force) * Math.min(36, l);
}
/** Motifs de tirets. */
const TIRETS_DEMANDE: readonly number[] = [6, 4];
const TIRETS_RAPPEL: readonly number[] = [2, 3];
const POINTILLES: readonly number[] = [1, 4];

/** Lignes de la note (réécrites à chaque image). */
let nota1 = '';
let nota2 = '';

function fx(force: number): number {
  const f = force < REGLE_MIN ? REGLE_MIN : force > REGLE_MAX ? REGLE_MAX : force;
  return REGLE_ZERO + f * REGLE_ECHELLE;
}

/** Ressort en zigzag de x0 à x1, à l'ordonnée y. */
function ressort(c: Crayon, x0: number, x1: number, y: number): void {
  const spires = 9;
  const amplitude = 7;
  const bout = 5;
  c.lot();
  c.segment(x0, y, x0 + bout, y);
  let px = x0 + bout;
  let py = y;
  const pas = (x1 - x0 - 2 * bout) / spires;
  for (let k = 0; k < spires; k += 1) {
    const nx = x0 + bout + (k + 0.5) * pas;
    const ny = y + (k % 2 === 0 ? -amplitude : amplitude);
    c.segment(px, py, nx, ny);
    px = nx;
    py = ny;
  }
  c.segment(px, py, x1 - bout, y);
  c.segment(x1 - bout, y, x1, y);
  c.finLot(1.5, 0.95, ENCRE);
}

/** Pointillés de rappel d'une pointe de flèche vers la colonne des valeurs. */
function rappel(c: Crayon, pointe: number, y: number): void {
  const x0 = Math.max(pointe, fx(0)) + 8;
  if (VALEURS_X - 6 - x0 > 14) c.tirets(x0, y, VALEURS_X - 6, y, POINTILLES, 1, 0.6);
}

/** Choisit la note d'explication qui correspond à la situation. */
function choisirNota(etat: Readonly<EtatRejeu>): void {
  const trajet = etat.trajet;
  const ph = trajet.physique;
  const s = etat.echantillon;
  const niveau2 = trajet.niveau === 'level2';
  const mg = ph.m * ph.g;
  if (etat.issueAtteinte && trajet.issue === 'bonk') {
    nota1 = 'Le bocal I s’est rempli pendant toute la montée (I = ' + nb(s.i) + ' N).';
    nota2 = 'Au-dessus de r, il poussait encore la cabine vers le haut : choc !';
  } else if (etat.phase === 'attente') {
    const p0 = trajet.kp * ph.r;
    nota1 = 'Au départ, e = ' + nb(ph.r) + ' m : le ressort demandera Kp × e = ' + nb(p0) + ' N.';
    nota2 =
      p0 > ph.uMax
        ? 'C’est plus que les ' + nb(ph.uMax) + ' N du moteur : il va saturer.'
        : 'Le moteur peut fournir cette force.';
  } else if (s.saturated) {
    nota1 =
      (niveau2 ? 'P + I demande ' : 'Le ressort P demande ') +
      nb(s.uCmd) +
      ' N, mais le moteur plafonne à ' +
      nb(ph.uMax) +
      ' N :';
    nota2 = 'les ' + nb(s.uCmd - ph.uMax) + ' N en trop sont perdus, la cabine accélère moins.';
  } else if (niveau2 && s.i > mg && s.e > 0.05) {
    nota1 = 'Le bocal I donne déjà ' + nb(s.i) + ' N, plus que le poids (' + nb(mg) + ' N) :';
    nota2 = 'même quand l’écart sera nul, il continuera de pousser vers le haut.';
  } else if (Math.abs(s.e) < 0.15 && Math.abs(s.v) < 0.3) {
    if (niveau2) {
      nota1 = 'Près du but, P ne tire presque plus (' + nb(s.p) + ' N) : c’est le bocal I';
      nota2 = '(' + nb(s.i) + ' N) qui tient la cabine contre son poids (' + nb(mg) + ' N).';
    } else {
      nota1 = 'Avec P seul, il reste un écart : pour porter le poids, le ressort doit';
      nota2 = 'rester étiré ; e vaut environ m·g / Kp = ' + nb(mg / trajet.kp, 2) + ' m.';
    }
  } else if (s.e < -0.02) {
    nota1 = 'La cabine a dépassé la consigne : e < 0, donc P = Kp × e < 0.';
    nota2 = niveau2
      ? 'Le ressort la retient et le bocal I commence à se vider.'
      : 'Le ressort la retient : la force du moteur passe sous le poids.';
  } else if (s.v < 0) {
    nota1 = 'La cabine redescend un peu : l’écart grandit de nouveau,';
    nota2 = 'le ressort P se tend et tire plus fort pour la remonter.';
  } else {
    nota1 = 'L’écart diminue, le ressort se détend : la force demandée baisse.';
    nota2 = niveau2
      ? 'Le bocal I, lui, continue de se remplir tant que e > 0.'
      : 'Le frottement c·v freine la cabine ; il grandit avec la vitesse.';
  }
}

/** Partie FIXE de la colonne « D'où vient la force ? » (peinte sur le fond, par trajet). */
export function dessinerForcesFixe(c: Crayon, trajet: TrajetReference): void {
  const physique = trajet.physique;
  const niveau2 = trajet.niveau === 'level2';
  const uMax = physique.uMax;
  const repos = RESSORT_X + RESSORT_REPOS;
  c.texte('1. L’écart :', X, 116, 15, 'left', ENCRE_PALE);
  c.texte(
    '2. Le ressort P tire d’autant plus fort que l’écart est grand',
    X,
    142,
    15,
    'left',
    ENCRE_PALE,
  );
  c.trait(RESSORT_X, RESSORT_Y - 12, RESSORT_X, RESSORT_Y + 12, 1.8, 1);
  c.hachures(RESSORT_X - 6, RESSORT_Y - 12, 6, 24, Math.PI / 4, 4, 0.8, 0.55);
  c.tirets(repos, RESSORT_Y - 10, repos, RESSORT_Y + 16, TIRETS_RAPPEL, 1, 0.7);
  if (niveau2) {
    const fond = BOCAL_Y + BOCAL_H;
    c.texte('3. Le bocal I accumule l’écart au fil du temps', X, 196, 15, 'left', ENCRE_PALE);
    c.texte('∫e dt (en m·s) = aire hachurée sous la courbe de e ;', X, 240, 14, 'left', ENCRE_PALE);
    c.texte('e > 0 remplit le bocal, e < 0 le vide.', X, 258, 14, 'left', ENCRE_PALE);
    c.trait(BOCAL_X, BOCAL_Y, BOCAL_X, fond, 1.8, 1, ENCRE, 0.3);
    c.trait(BOCAL_X, fond, BOCAL_X + BOCAL_L, fond, 1.8, 1, ENCRE, 0.3);
    c.trait(BOCAL_X + BOCAL_L, fond, BOCAL_X + BOCAL_L, BOCAL_Y, 1.8, 1, ENCRE, 0.3);
    c.trait(BOCAL_X - 4, BOCAL_Y, BOCAL_X + 4, BOCAL_Y, 1.6, 1, ENCRE, 0.2);
    c.trait(BOCAL_X + BOCAL_L - 4, BOCAL_Y, BOCAL_X + BOCAL_L + 4, BOCAL_Y, 1.6, 1, ENCRE, 0.2);
    c.lot();
    c.segment(BOCAL_X + BOCAL_L, BOCAL_Y + 6, BOCAL_X + BOCAL_L + 5, BOCAL_Y + 6);
    c.finLot(1, 0.8);
    c.texte('1 m·s', BOCAL_X + BOCAL_L + 2, BOCAL_Y + 20, 12, 'left', ENCRE_PALE);
  } else {
    c.texte('3. Niveau 1 : pas de bocal I (régleur P seul)', X, 196, 15, 'left', ENCRE_PALE);
    c.texte('I = 0 N (le bocal viendra au niveau 2)', X, 220, 18, 'left', ENCRE_PALE);
  }
  c.texte(
    '4. P + I = force demandée ; le moteur ne donne pas plus de ' + nb(uMax) + ' N',
    X,
    340,
    15,
    'left',
    ENCRE_PALE,
  );
  // Noms des rangs, à gauche du zéro.
  c.texte('P', REGLE_ZERO - 8, RANG_P + 5, 16, 'right');
  if (niveau2) c.texte('I', REGLE_ZERO - 8, RANG_I + 5, 16, 'right');
  c.texte(niveau2 ? 'P + I' : 'demandée', REGLE_ZERO - 8, RANG_DEMANDE + 5, 15, 'right');
  c.texte('moteur', REGLE_ZERO - 8, RANG_MOTEUR + 5, 15, 'right');
  c.tirets(REGLE_ZERO, RANG_P - 12, REGLE_ZERO, REGLE_Y, TIRETS_RAPPEL, 1, 0.6);
  // Axe gradué.
  c.trait(fx(REGLE_MIN), REGLE_Y, fx(REGLE_MAX), REGLE_Y, 1.4, 0.95);
  c.lot();
  for (let f = REGLE_MIN; f <= REGLE_MAX; f += 1000) {
    const l = f % 5000 === 0 ? 7 : 4;
    c.segment(fx(f), REGLE_Y, fx(f), REGLE_Y + l);
  }
  c.finLot(1, 0.9);
  for (let f = 0; f < REGLE_MAX; f += 5000) c.texte(nb(f), fx(f), REGLE_Y + 20, 13, 'center');
  c.texte(nb(REGLE_MAX) + ' N', fx(REGLE_MAX) + 4, REGLE_Y + 20, 13, 'right');
  // Le poids de la cabine, pour comparer.
  const mg = physique.m * physique.g;
  const xp = fx(mg);
  c.trait(xp, REGLE_Y - 4, xp, REGLE_Y + 4, 1.4, 1, ENCRE, 0);
  c.texte('m·g', xp + 4, REGLE_Y - 4, 13, 'left', ENCRE_PALE);
  c.texte('5. On isole la cabine : bilan des forces', X, 518, 15, 'left', ENCRE_PALE);
  c.gomme(ISOLEE_X - 20, ISOLEE_Y - 13, 40, 26);
  c.rect(ISOLEE_X - 20, ISOLEE_Y - 13, 40, 26, 1.8, 1, ENCRE, 1.5);
  c.hachures(ISOLEE_X - 20, ISOLEE_Y - 13, 40, 26, Math.PI / 4, 6, 0.8, 0.4);
  const lp = longueurIsolee(mg, uMax);
  c.fleche(ISOLEE_X - 8, ISOLEE_Y + 13, ISOLEE_X - 8, ISOLEE_Y + 13 + lp, 2, 1, ENCRE, 5);
  c.texte('m·g', ISOLEE_X - 14, ISOLEE_Y + 28, 14, 'right');
  const xc = 548;
  c.texte(
    'poids  m·g = ' + nb(physique.m) + ' × ' + nb(physique.g, 2) + ' = ' + nb(mg) + ' N',
    xc,
    558,
    16,
  );
}

/** Partie VARIABLE de la colonne « D'où vient la force ? » : valeurs, vecteurs, note. */
export function dessinerForces(c: Crayon, etat: Readonly<EtatRejeu>): void {
  const trajet = etat.trajet;
  const physique = trajet.physique;
  const s = etat.echantillon;
  const attente = etat.phase === 'attente';
  const niveau2 = trajet.niveau === 'level2';
  const uMax = physique.uMax;
  const alerte = s.saturated && !attente;
  const integrale = niveau2 && trajet.ki > 0 ? s.i / trajet.ki : 0;
  const rouge = alerte ? ROUGE : GRAPHITE;
  const rougeTexte = alerte ? ROUGE_TEXTE : ENCRE;

  // --- 1. L'écart ---------------------------------------------------------------------------
  c.texte(
    'e = r − y = ' + nb(physique.r, 2) + ' − ' + nb(s.y, 2) + ' = ' + nb(s.e, 2) + ' m',
    X + 72,
    116,
    19,
  );

  // --- 2. Le ressort P ----------------------------------------------------------------------
  c.texte(
    'P = Kp × e = ' + nb(trajet.kp) + ' × ' + nb(s.e, 3) + ' = ' + nb(s.p) + ' N',
    X,
    168,
    18,
  );
  const bout = RESSORT_X + Math.max(8, RESSORT_REPOS + s.e * RESSORT_PAR_M);
  ressort(c, RESSORT_X, bout, RESSORT_Y);
  c.cercle(bout + 3, RESSORT_Y, 3, 1.4, 1, ENCRE);
  const repos = RESSORT_X + RESSORT_REPOS;
  if (Math.abs(bout - repos) > 3) {
    c.cote(repos, RESSORT_Y + 14, bout, RESSORT_Y + 14, 1, 0.9, ENCRE);
    c.texte('e', (repos + bout) / 2, RESSORT_Y + 29, 14, 'center', ENCRE);
  }

  // --- 3. Le bocal I ------------------------------------------------------------------------
  if (niveau2) {
    c.texte(
      'I = Ki × ∫e dt = ' + nb(trajet.ki) + ' × ' + nb(integrale, 3) + ' = ' + nb(s.i) + ' N',
      X,
      220,
      18,
    );
    // Bocal : sable hachuré dont le niveau suit ∫e dt.
    const remplissage = Math.max(0, Math.min(1, integrale / BOCAL_PLEIN));
    const hs = remplissage * (BOCAL_H - 6);
    const fond = BOCAL_Y + BOCAL_H;
    c.hachures(BOCAL_X + 2, fond - hs, BOCAL_L - 4, hs, Math.PI / 4, 3.5, 1, 0.75);
    if (hs > 1) c.trait(BOCAL_X + 2, fond - hs, BOCAL_X + BOCAL_L - 2, fond - hs, 1.3, 0.95);
    // Ce qui entre (e > 0, par le haut) ou sort (e < 0, par le bas).
    if (!attente && Math.abs(s.e) > 0.01) {
      const xm = BOCAL_X + BOCAL_L / 2;
      if (s.e > 0) {
        c.fleche(xm, BOCAL_Y - 14, xm, BOCAL_Y - 1, 1.6, 1, ENCRE, 5);
        c.texte('+ e', xm - 5, BOCAL_Y - 3, 14, 'right', ENCRE);
      } else {
        c.fleche(BOCAL_X - 2, fond - 4, BOCAL_X - 20, fond + 6, 1.6, 1, ENCRE, 5);
        c.texte('− e', BOCAL_X - 22, fond - 6, 14, 'right', ENCRE);
      }
    }
  }

  // --- Nota : ce qui se passe en ce moment ----------------------------------------------------
  choisirNota(etat);
  c.gomme(X - 2, NOTA_Y, 424, NOTA_H);
  c.rect(X - 2, NOTA_Y, 424, NOTA_H, 1.3, 0.9, alerte ? ROUGE : ENCRE, 1.5);
  c.texte('Nota :', X + 6, NOTA_Y + 20, 16, 'left', rougeTexte, false);
  c.texte(nota1, X + 52, NOTA_Y + 20, 15, 'left', ENCRE, false);
  c.texte(nota2, X + 52, NOTA_Y + 40, 15, 'left', ENCRE, false);

  // --- 4. Addition et butée -----------------------------------------------------------------
  const xb = fx(uMax);
  c.rect(xb, BUTEE_HAUT, 8, REGLE_Y - BUTEE_HAUT, 1.6, 1, rouge);
  c.hachures(xb, BUTEE_HAUT, 8, REGLE_Y - BUTEE_HAUT, Math.PI / 4, 3.5, 1, 0.8, rouge);
  c.texte('butée ' + nb(uMax) + ' N', xb + 4, 358, 15, 'center', rougeTexte);
  if (alerte) c.texte('SATURATION !', xb + 64, 358, 17, 'left', ROUGE_TEXTE);
  // P, puis I mis bout à bout : l'addition des vecteurs.
  c.fleche(fx(0), RANG_P, fx(s.p), RANG_P, 2, 0.95, ENCRE, 7);
  rappel(c, fx(s.p), RANG_P);
  c.texte(nb(s.p) + ' N', VALEURS_X, RANG_P - 7, 15, 'left');
  if (niveau2) {
    c.tirets(fx(s.p), RANG_P, fx(s.p), RANG_I, TIRETS_RAPPEL, 1, 0.7);
    if (Math.abs(s.i) >= 1) c.fleche(fx(s.p), RANG_I, fx(s.p + s.i), RANG_I, 2, 0.95, ENCRE, 7);
    rappel(c, Math.max(fx(s.p), fx(s.p + s.i)), RANG_I);
    c.texte(nb(s.i) + ' N, mis au bout de P', VALEURS_X, RANG_I - 7, 15, 'left');
  }
  // Force demandée : jusqu'à la butée en tirets, au-delà hachurée (écrêtée, rouge en marche).
  c.tirets(
    fx(0),
    RANG_DEMANDE,
    fx(Math.min(s.uCmd, uMax)),
    RANG_DEMANDE,
    TIRETS_DEMANDE,
    1.8,
    0.95,
    ENCRE,
  );
  if (s.uCmd > uMax) {
    const xa = xb + 8;
    const xz = fx(s.uCmd);
    if (xz > xa) {
      c.hachures(xa, RANG_DEMANDE - 5, xz - xa, 10, -Math.PI / 4, 4, 1, alerte ? 0.75 : 0.4, rouge);
      c.tirets(xa, RANG_DEMANDE, xz, RANG_DEMANDE, TIRETS_DEMANDE, 1.8, 0.95, rouge);
    }
    c.pointe(xz - 10, RANG_DEMANDE, xz, RANG_DEMANDE, 1.8, 0.95, rouge, 7);
    c.texte(
      nb(s.uCmd) + ' N demandés, dont ' + nb(s.uCmd - uMax) + ' N écrêtés',
      VALEURS_X,
      RANG_DEMANDE - 7,
      15,
      'left',
      rougeTexte,
    );
  } else {
    const xz = fx(s.uCmd);
    c.pointe(xz - Math.sign(s.uCmd) * 10, RANG_DEMANDE, xz, RANG_DEMANDE, 1.8, 0.95, ENCRE, 7);
    rappel(c, xz, RANG_DEMANDE);
    c.texte(nb(s.uCmd) + ' N demandés', VALEURS_X, RANG_DEMANDE - 7, 15, 'left');
  }
  // Force appliquée : barre hachurée appuyée (la jauge du moteur), bornée à ±Umax.
  const xa0 = Math.min(fx(0), fx(s.uSat));
  const xa1 = Math.max(fx(0), fx(s.uSat));
  c.hachures(xa0, RANG_MOTEUR - 6, xa1 - xa0, 12, Math.PI / 4, 3, 1, 0.8, rouge);
  c.rect(xa0, RANG_MOTEUR - 6, xa1 - xa0, 12, 1.6, 1, alerte ? ROUGE : ENCRE, 1);
  if (!alerte) rappel(c, xa1, RANG_MOTEUR);
  c.texte(
    nb(s.uSat) + ' N appliqués' + (alerte ? ' : le maximum' : ''),
    VALEURS_X,
    RANG_MOTEUR - 9,
    15,
    'left',
    rougeTexte,
  );

  // --- 5. La cabine isolée ------------------------------------------------------------------
  const mg = physique.m * physique.g;
  const frottement = physique.c * s.v;
  const nette = s.uSat - mg - frottement;
  const lt = longueurIsolee(s.uSat, uMax);
  c.fleche(
    ISOLEE_X,
    ISOLEE_Y - 13,
    ISOLEE_X,
    ISOLEE_Y - 13 - lt,
    2.2,
    1,
    alerte ? ROUGE : ENCRE,
    7,
  );
  c.texte('T', ISOLEE_X - 6, ISOLEE_Y - 13 - Math.max(4, lt * 0.5) + 5, 15, 'right', rougeTexte);
  if (Math.abs(frottement) > 20) {
    const lf = longueurIsolee(-frottement, uMax);
    const yf = ISOLEE_Y;
    c.fleche(ISOLEE_X + 22, yf, ISOLEE_X + 22, yf + lf, 2, 1, ENCRE, 6);
    c.texte('c·v', ISOLEE_X + 28, yf + lf / 2 + 5, 14, 'left');
  }
  const xc = 548;
  c.texte('traction  T = ' + nb(s.uSat) + ' N', xc, 540, 16, 'left', rougeTexte);
  c.texte(
    'frottement  c·v = ' + nb(physique.c) + ' × ' + nb(s.v, 2) + ' = ' + nb(frottement) + ' N',
    xc,
    576,
    16,
  );
  if (Math.abs(nette / physique.m - s.a) > 0.05) {
    c.texte('cabine posée au sol : a = 0', xc, 598, 17);
  } else {
    c.texte(
      'a = (T − m·g − c·v)/m = ' + nb(nette) + '/' + nb(physique.m) + ' = ' + nb(s.a, 1) + ' m/s²',
      xc,
      598,
      16,
    );
  }
}
