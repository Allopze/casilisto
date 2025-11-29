# CasiListo - Release de Producción

## Servidor Unificado
Un solo servidor Node.js que sirve:
- Frontend (archivos estáticos)
- API de sincronización

## Archivos
- `server.js` - Servidor unificado (frontend + API)
- `db.js` - Base de datos SQLite
- `package.json` - Dependencias
- `index.html` - Frontend
- `assets/` - CSS y JS compilados

## Despliegue

### Opción 1: PaaS Node.js
Sube toda la carpeta. Tu PaaS detectará `package.json` y ejecutará:
`
npm install
npm start
`

### Opción 2: Manual
`ash
npm install
node server.js
`

## Puerto
Por defecto: 3000 (o la variable de entorno PORT)
