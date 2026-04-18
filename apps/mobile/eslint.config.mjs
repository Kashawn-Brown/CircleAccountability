import expoConfig from 'eslint-config-expo/flat.js';

// eslint-config-expo bundles @typescript-eslint, react, react-native, and
// react-hooks rules already tuned for Expo apps. Flat config entrypoint
// (`eslint-config-expo/flat`) returns a config array we spread into our own.
export default [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'ios/**', 'android/**'],
  },
];
