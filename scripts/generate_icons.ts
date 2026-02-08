import sharp from "sharp";
import fs from "fs";

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

const input = "assets/icon.svg";
const outDir = "assets/";

fs.mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  await sharp(input, { density: 1024 })
    .resize(size, size)
    .png()
    .toFile(`${outDir}/icon${size}.png`);
}
