const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const manifestPath = path.join(__dirname, 'release-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  return { ...config, extra: { ...config.extra, release: manifest ? { commit: manifest.commit, sourceHash: manifest.sourceHash, createdAt: manifest.createdAt } : null } };
};
