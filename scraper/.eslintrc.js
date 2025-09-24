module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ['dist', '.eslintrc.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-console': 'warn',
  },
};