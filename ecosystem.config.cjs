module.exports = {
  apps: [
    {
      name: 'vaultline',
      cwd: '/home/dustin/apps/vaultline',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
