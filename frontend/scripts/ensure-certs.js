const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certDir = path.resolve(__dirname, '../certs');
const certPath = path.join(certDir, 'cert.pem');
const keyPath = path.join(certDir, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('[ensure-certs] SSL certificates not found in frontend/certs. Generating self-signed certificates...');
  fs.mkdirSync(certDir, { recursive: true });
  try {
    execSync('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"', {
      cwd: certDir,
      stdio: 'pipe'
    });
    console.log('[ensure-certs] Successfully generated self-signed certificates in frontend/certs.');
  } catch (error) {
    console.error('[ensure-certs] Failed to generate certificates with openssl:', error.message);
  }
}
