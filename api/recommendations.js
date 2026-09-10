const { handleRecommendations } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleRecommendations(req, res);
};
