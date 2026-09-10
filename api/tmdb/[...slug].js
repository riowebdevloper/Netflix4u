const { handleTmdb } = require('../../services/apiCore');

module.exports = async (req, res) => {
  let subPath = '';
  if (req.query && req.query.slug) {
    const slug = req.query.slug;
    subPath = '/' + (Array.isArray(slug) ? slug.join('/') : slug);
  }
  return handleTmdb(req, res, subPath);
};
