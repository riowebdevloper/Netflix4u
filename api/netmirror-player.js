const { handleNetmirrorPlayer } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleNetmirrorPlayer(req, res);
};
