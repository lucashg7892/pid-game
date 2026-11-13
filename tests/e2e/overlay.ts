/**
 * Interface DOM (T-010) dans les tests de pixels du rendu (T-008, T-009) : ces tests vérifient le
 * papier et le crayon pixel par pixel ; l'interface superposée (titre, bandeau, panneaux) y est
 * masquée pour qu'ils continuent de mesurer le seul rendu. L'interface est testée par ui.spec.ts.
 */
import type { Page } from '@playwright/test';

/**
 * Masque l'interface superposée (`#ui`) de la page courante, y compris si elle est créée après.
 * @param page page Playwright, déjà chargée.
 */
export async function hideUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: '#ui { visibility: hidden !important; }' });
}
