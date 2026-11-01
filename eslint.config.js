// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // A web/HTML rule: React Native <Text> renders ' and " as typed.
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
]);
