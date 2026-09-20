/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its bundled font metrics (.afm files) off disk at runtime via
  // paths relative to its own __dirname. If webpack bundles it into a .next
  // chunk, that __dirname points at the chunk instead of node_modules/pdfkit,
  // and the font files go missing (ENOENT). Keeping it external makes Node
  // require() it normally from node_modules, where __dirname is correct.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = nextConfig;
