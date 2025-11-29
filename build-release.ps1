# Script para crear release lista para producción
# Uso: .\build-release.ps1
# Genera una carpeta release/ con:
#   - index.html en la raíz (para sitios estáticos)
#   - index.js en la raíz (para Node.js)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Creando release de CasiListo..." -ForegroundColor Cyan

# 1. Limpiar carpeta release anterior
$releaseDir = ".\release"
if (Test-Path $releaseDir) {
    Write-Host "Limpiando release anterior..." -ForegroundColor Yellow
    Remove-Item -Path $releaseDir -Recurse -Force
}

# 2. Crear carpeta release
Write-Host "Creando estructura..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# 3. Compilar frontend
Write-Host "Compilando frontend..." -ForegroundColor Yellow
npm run build

# 4. Copiar frontend (index.html en raíz)
Write-Host "Copiando frontend..." -ForegroundColor Yellow
Copy-Item -Path ".\dist\*" -Destination $releaseDir -Recurse

# 5. Copiar backend (server.js unificado)
Write-Host "Copiando backend..." -ForegroundColor Yellow
Copy-Item -Path ".\server\server.js" -Destination $releaseDir
Copy-Item -Path ".\server\db.js" -Destination $releaseDir

# 6. Crear package.json para producción
$packageJson = @"
{
  "name": "casilisto",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.6.0",
    "express": "^4.21.1"
  }
}
"@
$packageJson | Out-File -FilePath "$releaseDir\package.json" -Encoding UTF8

# 7. Crear README
$readme = @"
# CasiListo - Release de Producción

## Servidor Unificado
Un solo servidor Node.js que sirve:
- Frontend (archivos estáticos)
- API de sincronización

## Archivos
- ``server.js`` - Servidor unificado (frontend + API)
- ``db.js`` - Base de datos SQLite
- ``package.json`` - Dependencias
- ``index.html`` - Frontend
- ``assets/`` - CSS y JS compilados

## Despliegue

### Opción 1: PaaS Node.js
Sube toda la carpeta. Tu PaaS detectará ``package.json`` y ejecutará:
```
npm install
npm start
```

### Opción 2: Manual
```bash
npm install
node server.js
```

## Puerto
Por defecto: 3000 (o la variable de entorno PORT)
"@

$readme | Out-File -FilePath "$releaseDir\README.md" -Encoding UTF8

# 8. Mostrar resultado
Write-Host ""
Write-Host "✅ Release creada exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Carpeta: $((Resolve-Path $releaseDir).Path)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Estructura:" -ForegroundColor Yellow
Write-Host "  release/"
Write-Host "  ├── server.js       ← Servidor unificado (Node.js)" -ForegroundColor Yellow
Write-Host "  ├── db.js"
Write-Host "  ├── package.json"
Write-Host "  ├── index.html      ← Frontend" -ForegroundColor Cyan
Write-Host "  ├── assets/"
Write-Host "  ├── sw.js"
Write-Host "  └── ..."
Write-Host ""
Write-Host "Tu PaaS ejecutará: npm install && npm start" -ForegroundColor Green
Write-Host ""
