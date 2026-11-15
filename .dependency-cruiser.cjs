/** Règles d'architecture (spec T-001 §3). @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'sim-is-pure',
      comment: 'src/sim ne dépend que de src/sim (ni paquet externe, ni autre module).',
      severity: 'error',
      from: { path: '^src/sim/' },
      to: { pathNot: '^src/sim/' },
    },
    {
      name: 'i18n-is-pure',
      comment: 'src/i18n ne dépend que de src/i18n.',
      severity: 'error',
      from: { path: '^src/i18n/' },
      to: { pathNot: '^src/i18n/' },
    },
    {
      name: 'app-is-pure',
      comment: 'src/app ne dépend que de src/app (machine d’écrans pure, spec T-017).',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { pathNot: '^src/app/' },
    },
    {
      name: 'game-no-render',
      comment: 'src/game ne dépend que de src/game et src/sim.',
      severity: 'error',
      from: { path: '^src/game/' },
      to: { pathNot: '^src/(game|sim)/' },
    },
    {
      name: 'render-deps',
      comment: 'src/render peut importer src/sim, src/game et three, pas ui, i18n ni app.',
      severity: 'error',
      from: { path: '^src/render/' },
      to: { path: '^src/(ui|i18n|app)/' },
    },
    {
      name: 'ui-deps',
      comment: 'src/ui peut importer src/game et src/i18n, pas sim ni render.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(sim|render)/' },
    },
    {
      name: 'proto-isolated',
      comment:
        'Les maquettes (src/proto) sont jetables : le jeu ne les importe pas (seuls src/main.ts, src/proto et tests/ le peuvent).',
      severity: 'error',
      from: { path: '^src/(sim|game|i18n|render|ui|app)/' },
      to: { path: '^src/proto/' },
    },
    {
      name: 'proto-common-pure',
      comment:
        'src/proto/common est pur : il ne dépend que de src/proto/common (ni rendu, ni ui, ni paquet externe ; le DOM est vérifié par tests/proto/pur.test.ts).',
      severity: 'error',
      from: { path: '^src/proto/common/' },
      to: { pathNot: '^src/proto/common/' },
    },
    {
      name: 'three-only-in-render',
      comment:
        'three ne peut être importé que dans src/render (réserve E2 de T-002 levée en T-008).',
      severity: 'error',
      from: { pathNot: '^src/render/' },
      to: { path: '(^|/)node_modules/three/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
