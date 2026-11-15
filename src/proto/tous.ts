/**
 * Page `?proto=tous` (lot B, v0.3) : les quatre maquettes côte à côte, en iframes à l'échelle 0,5
 * (chacune rendue en 1280×720 puis réduite), toutes rejouant le MÊME trajet de référence au même
 * moment. Touches de la page : 1, 2, 3 (trajet victoire, choc, saturation, lancé dans les quatre),
 * P (pause), R (rejouer). Jetable comme les maquettes : aucun test.
 */
import { TRAJETS_REFERENCE } from './common/trajets';
import type { IdTrajet } from './common/types';
import type { MessageCommande, NomMaquette } from './contrat';

const NOMS: readonly NomMaquette[] = ['a', 'b', 'c', 'd'];
const ORDRE: readonly IdTrajet[] = ['victoire', 'choc', 'saturation'];
const TITRES: Readonly<Record<NomMaquette, string>> = {
  a: 'A · Salle de commande analogique',
  b: 'B · Instruments seuls',
  c: 'C · Tube cathodique',
  d: 'D · Carte blanche',
};

/** Monte la page des quatre maquettes ; renvoie la fonction qui la démonte. */
export function lancerTous(): () => void {
  document.documentElement.style.cssText = 'margin:0;height:100%;overflow:auto;background:#e9e2cd;';
  document.body.style.cssText =
    'margin:0;min-height:100%;background:#e9e2cd;color:#2a2724;font:14px system-ui,sans-serif;';
  document.querySelector('#scene')?.setAttribute('hidden', '');
  const page = document.createElement('div');
  page.style.cssText = 'padding:8px;box-sizing:border-box;';
  const barre = document.createElement('div');
  barre.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';
  const frames: HTMLIFrameElement[] = [];
  const envoyer = (message: MessageCommande): void => {
    for (const f of frames) f.contentWindow?.postMessage(message, '*');
  };
  const bouton = (texte: string, message: MessageCommande): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texte;
    b.style.cssText = 'font:inherit;padding:4px 10px;';
    b.addEventListener('click', () => {
      envoyer(message);
    });
    barre.append(b);
  };
  ORDRE.forEach((id, i) => {
    const trajet = TRAJETS_REFERENCE.find((t) => t.id === id);
    bouton(`${String(i + 1)} · ${id}${trajet ? ` (${trajet.issue})` : ''}`, {
      proto: 'cmd',
      cmd: 'trajet',
      id,
    });
  });
  bouton('P · pause', { proto: 'cmd', cmd: 'pause' });
  bouton('R · rejouer', { proto: 'cmd', cmd: 'rejouer' });
  const note = document.createElement('span');
  note.style.cssText = 'opacity:0.7;';
  note.textContent = 'Même trajet, au même moment, dans les quatre maquettes (iframes à 50 %).';
  barre.append(note);

  const grille = document.createElement('div');
  grille.style.cssText = 'display:grid;grid-template-columns:repeat(2,640px);gap:8px;width:1288px;';
  for (const nom of NOMS) {
    const cadre = document.createElement('figure');
    cadre.style.cssText = 'margin:0;width:640px;';
    const legende = document.createElement('figcaption');
    legende.style.cssText = 'font-weight:600;margin:0 0 2px 2px;';
    legende.textContent = TITRES[nom];
    const boite = document.createElement('div');
    boite.style.cssText =
      'width:640px;height:360px;overflow:hidden;border:1px solid #2a2724;background:#f7f0de;';
    const f = document.createElement('iframe');
    f.src = `?proto=${nom}&embed=1&trajet=victoire`;
    f.title = TITRES[nom];
    f.style.cssText =
      'width:1280px;height:720px;border:0;transform:scale(0.5);transform-origin:0 0;display:block;';
    boite.append(f);
    cadre.append(legende, boite);
    grille.append(cadre);
    frames.push(f);
  }
  page.append(barre, grille);
  document.body.append(page);

  const surTouche = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
    if ((e.code.startsWith('Digit') || e.code.startsWith('Numpad')) && i >= 0) {
      envoyer({ proto: 'cmd', cmd: 'trajet', id: ORDRE[i] });
    } else if (e.code === 'KeyP') envoyer({ proto: 'cmd', cmd: 'pause' });
    else if (e.code === 'KeyR') envoyer({ proto: 'cmd', cmd: 'rejouer' });
  };
  window.addEventListener('keydown', surTouche);
  return () => {
    window.removeEventListener('keydown', surTouche);
    page.remove();
  };
}
