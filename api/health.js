const { handleHealth } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleHealth(req, res);
};
