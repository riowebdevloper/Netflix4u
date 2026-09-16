const { handleStreamPlayer } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleStreamPlayer(req, res);
};
