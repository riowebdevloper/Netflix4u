const { handleCast } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleCast(req, res);
};
