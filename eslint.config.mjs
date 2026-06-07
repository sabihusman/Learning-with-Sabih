import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // reference / scratch files at repo root that are not part of the app
    'study-guide-demo.jsx',
    // Playwright e2e tests + reports are linted by Playwright/tsc, not next lint
    'e2e/**',
    'playwright.config.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    // These two react rules are noise for a React Three Fiber + plain-JS project,
    // and we mirror the same suppressions in SonarQube (S6774, S6747).
    //   - react/prop-types: we do not use PropTypes (and there is no TypeScript),
    //     so the "missing in props validation" reports are not actionable here.
    //   - react/no-unknown-property: R3F intentionally sets three.js props such as
    //     position, args, roughness, and intensity on its custom elements; these
    //     are valid, not unknown DOM attributes.
    // eslint-config-next already disables both; we set them off explicitly so the
    // intent is documented and survives a future config change.
    rules: {
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',
    },
  },
])

export default eslintConfig
