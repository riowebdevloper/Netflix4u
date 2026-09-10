const { handlePlayback } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handlePlayback(req, res);
};
