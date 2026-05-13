module.exports = {
  apps: [
    {
      name: 'agent-storage',
      cwd: '/home/dustin/apps/agent-storage',
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
