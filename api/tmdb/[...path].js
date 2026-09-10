const { handleTmdb } = require('../../services/apiCore');

module.exports = async (req, res) => {
  let subPath = '';
  if (req.query && req.query.path) {
    const p = req.query.path;
    subPath = '/' + (Array.isArray(p) ? p.join('/') : p);
  } else {
    const [rawPath] = (req.url || '').split('?');
    subPath = rawPath.replace(/^\/api\/tmdb/, '');
  }
  return handleTmdb(req, res, subPath);
};
