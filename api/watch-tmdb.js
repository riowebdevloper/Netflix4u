const { handleWatchTmdb } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleWatchTmdb(req, res);
};
