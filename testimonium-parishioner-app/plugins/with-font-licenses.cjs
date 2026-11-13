const fs = require("node:fs/promises");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

// Retain the redistribution notices inside the APK as well as in source control.
module.exports = function withFontLicenses(config) {
  return withDangerousMod(config, ["android", async config => {
    const { projectRoot, platformProjectRoot } = config.modRequest;
    const destination = path.join(platformProjectRoot, "app/src/main/assets/licenses");
    await fs.mkdir(destination, { recursive: true });
    for (const family of ["Inter", "PlayfairDisplay"]) {
      await fs.copyFile(
        path.join(projectRoot, "assets/fonts", family, "OFL.txt"),
        path.join(destination, `${family}-OFL.txt`),
      );
    }
    return config;
  }]);
};
