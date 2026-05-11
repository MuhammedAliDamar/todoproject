module.exports = {
  apps: [
    {
      name: "marktasks",
      cwd: "/var/www/marktasks.com",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
