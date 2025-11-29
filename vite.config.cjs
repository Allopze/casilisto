const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const fs = require('fs');
const path = require('path');

/**
 * Plugin para generar asset-manifest.json con las rutas de assets generados.
 * Esto permite que el SW precachee los archivos JS/CSS hasheados.
 */
function assetManifestPlugin() {
  return {
    name: 'asset-manifest',
    writeBundle(options, bundle) {
      const outDir = options.dir || 'dist';
      const assets = [];
      for (const [fileName] of Object.entries(bundle)) {
        if (fileName.startsWith('assets/') && (fileName.endsWith('.js') || fileName.endsWith('.css'))) {
          assets.push('/' + fileName);
        }
      }
      const manifestPath = path.join(outDir, 'asset-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(assets, null, 2));
    },
  };
}

module.exports = defineConfig({
  plugins: [react(), assetManifestPlugin()],
  server: {
    host: true,
    port: 1103,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
  },
});
