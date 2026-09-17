const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const versionPath = path.join(__dirname, '..', 'version.json');
    if (fs.existsSync(versionPath)) {
      const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return res.status(200).json(data);
    }
  } catch (e) {}

  return res.status(200).json({
    version: '3.3.0',
    build: 1742201000,
    updatedAt: new Date().toISOString()
  });
};
