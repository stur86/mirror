const path = require("path");
const pkg = require(path.join(__dirname, "../../package.json"));

module.exports = function () {
  return {
    tag: process.env.RELEASE_TAG || `v${pkg.version}`,
    githubRepo: "stur86/mirror",
  };
};
