/**
 * Routeur des maquettes (lot B, v0.3) : appelé par `src/main.ts` seulement quand l'URL contient
 * `?proto=…` (import dynamique : rien de ce dossier n'entre dans le jeu normal).
 * `?proto=c` : la maquette C (tube cathodique), seule conservée.
 */
import { estNomMaquette, lancerMaquette } from './coque';

/** Lance la page `?proto=<nom>` ; renvoie la fonction qui la démonte. */
export async function lancerProto(nom: string, params: URLSearchParams): Promise<() => void> {
  if (estNomMaquette(nom)) return lancerMaquette(nom, params);
  const message = document.createElement('p');
  message.style.cssText = 'margin:2rem;font:16px system-ui,sans-serif;';
  message.textContent = `Maquette inconnue : « ${nom} ». Essayer ?proto=c.`;
  document.body.append(message);
  return () => {
    message.remove();
  };
}
