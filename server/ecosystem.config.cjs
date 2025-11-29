// Configuración de PM2 para el servidor de sincronización
module.exports = {
  apps: [{
    name: 'casilisto-sync',
    script: 'index.js',
    cwd: '/var/www/casilisto/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
