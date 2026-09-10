const { handleTmdb } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleTmdb(req, res);
};
