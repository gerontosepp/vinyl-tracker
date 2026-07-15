const PROXY_CONFIG = {
  "/api": {
    "target": process.env.VITE_API_TARGET || "http://localhost:8080",
    "secure": false,
    "changeOrigin": true
  }
};

module.exports = PROXY_CONFIG;
