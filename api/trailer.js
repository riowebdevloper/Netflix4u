const { handleTrailer } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleTrailer(req, res);
};
