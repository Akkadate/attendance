module.exports = {
  apps: [
    {
      name: "deknbu",
      cwd: "/var/www/app/Linelffregister",
      script: "register-server.js",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
    },
    {
      name: "attendance",
      cwd: "/var/www/app/Attendnace",
      script: "attendance-server.js",
      env: {
        PORT: 4000,
        NODE_ENV: "production",
      },
    },
  ],
};
