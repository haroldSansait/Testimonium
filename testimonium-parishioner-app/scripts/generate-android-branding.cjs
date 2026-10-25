/* global __dirname */
// Mechanical resizing/padding only; the approved source artwork is unchanged.
const path = require("node:path");
const Jimp = require("jimp-compact");

async function generate() {
  const source = await Jimp.read(path.join(__dirname, "../assets/images/TESTIMONIUM_official_logo.png"));
  const output = path.join(__dirname, "../assets/images/android");
  const icon = new Jimp(1024, 1024, "#FBF4F5");
  icon.composite(source.clone().resize(880, 880), 72, 72);
  await icon.writeAsync(path.join(output, "icon.png"));

  // Full source fits in 64/108 of the layer. Its circular artwork has additional
  // transparent source margins, keeping it inside Android's 66dp safe circle.
  const foreground = new Jimp(1080, 1080, 0x00000000);
  foreground.composite(source.clone().resize(640, 640), 220, 220);
  await foreground.writeAsync(path.join(output, "adaptive-foreground.png"));

  // Cream circular backing preserves the crimson artwork on a crimson splash.
  const splash = new Jimp(512, 512, "#FBF4F5").circle();
  splash.composite(source.clone().resize(480, 480), 16, 16);
  await splash.writeAsync(path.join(output, "splash-logo.png"));
}

generate().catch(error => { console.error(error.message); process.exitCode = 1; });
