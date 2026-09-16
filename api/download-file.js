const { handleDownloadFile } = require('../services/apiCore');

module.exports = async (req, res) => {
  return handleDownloadFile(req, res);
};
