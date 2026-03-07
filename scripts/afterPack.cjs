const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook.
 * Removes optional Chromium assets that Mirror doesn't use.
 */
exports.default = async function afterPack({ appOutDir, packager }) {
  const platform = packager.platform.name;

  const toRemove = [
    // Software WebGL/Vulkan fallback renderer — not needed for a text editor.
    // Present on Windows and Linux; absent on macOS.
    'swiftshader',
  ];

  for (const name of toRemove) {
    const target = path.join(appOutDir, name);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`afterPack: removed ${name} (${platform})`);
    }
  }
};
