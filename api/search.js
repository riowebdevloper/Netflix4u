const { handleSearch } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleSearch(req, res);
};
