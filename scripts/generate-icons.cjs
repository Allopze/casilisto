/**
 * Script para generar iconos PNG desde el SVG.
 * Requiere: npm install sharp
 * Uso: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

// Intentar usar sharp si está disponible
async function generateWithSharp() {
  const sharp = require('sharp');
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const svg = fs.readFileSync(svgPath);

  const sizes = [192, 512];
  
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `../public/icon-${size}.png`));
    console.log(`✓ Generado icon-${size}.png`);
  }

  // Generar og-image (1200x630 para Open Graph)
  await sharp(svg)
    .resize(630, 630)
    .extend({
      top: 0,
      bottom: 0,
      left: 285,
      right: 285,
      background: { r: 254, g: 243, b: 199, alpha: 1 } // yellow-50
    })
    .png()
    .toFile(path.join(__dirname, '../public/og-image.png'));
  console.log('✓ Generado og-image.png');
}

// Fallback: crear PNGs básicos inline en base64
function generateFallbackPNGs() {
  console.log('Sharp no disponible. Creando iconos SVG alternativos...');
  
  // Crear versiones SVG con tamaño fijo como fallback
  const svgContent = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  
  // Para PNG, necesitamos sharp. Mostramos instrucciones.
  console.log('\nPara generar PNGs de alta calidad:');
  console.log('1. npm install sharp');
  console.log('2. node scripts/generate-icons.js');
  console.log('\nO usa una herramienta online como realfavicongenerator.net');
}

// Ejecutar
(async () => {
  try {
    await generateWithSharp();
    console.log('\n✅ Todos los iconos generados correctamente');
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      generateFallbackPNGs();
    } else {
      console.error('Error:', e.message);
    }
  }
})();
