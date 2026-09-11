const { handleEmbedTmdb } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleEmbedTmdb(req, res);
};
