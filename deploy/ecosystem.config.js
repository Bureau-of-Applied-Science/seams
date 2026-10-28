module.exports = {
  apps: [{
    name: 'seams',
    script: 'server.js',
    cwd: '/var/www/seams',
    env: { PORT: 3010, HOST: '127.0.0.1', ORIGIN: 'https://seams.bureauofapplied.science' },
    max_memory_restart: '300M'
  }]
};
