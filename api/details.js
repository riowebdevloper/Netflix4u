const { handleDetails } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleDetails(req, res);
};
