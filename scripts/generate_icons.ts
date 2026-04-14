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

// Generate macOS .iconset folder
// iconutil (macOS-only) can convert this to AppIcon.icns if needed;
// electron-builder uses icon1024.png directly for macOS packaging.
const iconsetDir = `${outDir}/icon.iconset`;
fs.mkdirSync(iconsetDir, { recursive: true });
const iconsetSizes: Array<[number, string]> = [
  [16,   "icon_16x16.png"],
  [32,   "icon_16x16@2x.png"],
  [32,   "icon_32x32.png"],
  [64,   "icon_32x32@2x.png"],
  [128,  "icon_128x128.png"],
  [256,  "icon_128x128@2x.png"],
  [256,  "icon_256x256.png"],
  [512,  "icon_256x256@2x.png"],
  [512,  "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];
await Promise.all(
  iconsetSizes.map(([size, filename]) =>
    sharp(input, { density: 1024 })
      .resize(size, size)
      .png()
      .toFile(`${iconsetDir}/${filename}`)
  )
);
console.log("Generated icon.iconset/");
