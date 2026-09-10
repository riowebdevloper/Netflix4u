const { handleTmdbLookup } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleTmdbLookup(req, res);
};
