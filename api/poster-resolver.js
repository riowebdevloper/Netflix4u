const { handlePosterResolver } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handlePosterResolver(req, res);
};
