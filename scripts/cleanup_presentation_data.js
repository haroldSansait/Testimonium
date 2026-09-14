const { spawn } = require("child_process");
const path = require("path");

const targetScript = path.resolve(__dirname, "../testimonium-backend/scripts/cleanup_presentation_data.js");
const backendCwd = path.resolve(__dirname, "../testimonium-backend");

const child = spawn(process.execPath, [targetScript, ...process.argv.slice(2)], {
  cwd: backendCwd,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
