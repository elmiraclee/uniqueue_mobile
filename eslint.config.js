const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
 expoConfig,
 { ignores: ['dist/**','validation/**'] },
 { rules: { 'react-hooks/set-state-in-effect':'warn', 'react-hooks/refs':'warn' } },
]);
