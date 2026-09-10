const { handleSummary } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleSummary(req, res);
};
