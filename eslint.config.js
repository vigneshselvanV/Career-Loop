import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'backend/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
