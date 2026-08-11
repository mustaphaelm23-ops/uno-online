// PM2 process config — the production equivalent of start-server.bat.
// PM2 restarts the server on crash, on reboot, and keeps logs.
//
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup      # survive server reboots
//   pm2 logs cardora             # live logs
//   pm2 monit                    # CPU/RAM dashboard
//
// NOTE: instances stays at 1 on purpose. Game rooms live in this process's
// memory, so running several copies would split players across processes
// that can't see each other. Going multi-process needs Redis + room
// affinity first (see DEPLOY.md → "Scaling beyond one process").
module.exports = {
  apps: [{
    name: 'cardora',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 50,
    min_uptime: '30s',
    // Restart if the process balloons past 1GB (leak guard, not a limit
    // we expect to hit — normal usage sits near 100–300MB).
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    time: true,
  }],
};
