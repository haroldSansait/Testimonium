const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");
module.exports = defineConfig([
  {
    ignores: [".expo/**", "node_modules/**", "dist/**"],
  },
  expoConfig,
]);