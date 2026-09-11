const { handleUniversalApi } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleUniversalApi(req, res);
};
