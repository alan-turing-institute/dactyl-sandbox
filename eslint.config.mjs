import js from '@eslint/js';

const browserGlobals = {
  console: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  Intl: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  __dirname: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
};

const jestGlobals = {
  afterEach: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  jest: 'readonly',
  test: 'readonly',
};

export default [
  {
    ignores: ['coverage/**', 'data/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals,
    },
  },
  {
    files: ['server.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: nodeGlobals,
    },
  },
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...nodeGlobals, ...jestGlobals },
    },
  },
];
