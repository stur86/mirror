const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
  eleventyConfig.setLibrary("md", md);

  // Passthrough copy for favicon
  eleventyConfig.addPassthroughCopy({"../assets/icon32.png": "icon.png"});

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
