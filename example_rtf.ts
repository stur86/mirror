import { rtfToHtml } from "./src/utils/rtfConvert";

async function main() {
    // Get file from command line arguments
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Usage: node example_rtf.js <path_to_rtf_file>");
        process.exit(1);
    }

    try {
        // Read the RTF file as an ArrayBuffer
        const fs = require('fs').promises;
        const buffer = await fs.readFile(filePath);

        // Convert RTF to HTML
        const html = await rtfToHtml(buffer);
        console.log(html);
    } catch (error) {
        console.error("Error processing RTF file:", error);
    }
}

main();