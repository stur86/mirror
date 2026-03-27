import sharp from "sharp";
import pngToIco from "png-to-ico";
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

// Generate Windows ICO (multi-resolution: 16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((size) =>
    sharp(input, { density: 1024 }).resize(size, size).png().toBuffer()
  )
);
const icoData = await pngToIco(icoBuffers);
fs.writeFileSync(`${outDir}/icon.ico`, icoData);
console.log("Generated icon.ico");
