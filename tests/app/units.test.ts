import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('pureté de src/app (spec T-017 §2)', () => {
  it('n’importe que src/app ; ni aléa, ni horloge, ni DOM', () => {
    const dir = new URL('../../src/app/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.random|\bDate\b|\bperformance\b|\bwindow\b|\bdocument\b/);
      for (const m of code.matchAll(/from '([^']+)'/g)) {
        expect(m[1], f).toMatch(/^\.\//);
      }
    }
  });
});
