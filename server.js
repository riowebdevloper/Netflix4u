// Netflix4U Production Server Entry for cPanel (Phusion Passenger / CloudLinux) and Vercel fallback
const { handleUniversalApi } = require('./services/apiCore');

if (require.main === module) {
  require('./dev-server.js');
} else {
  module.exports = handleUniversalApi;
}
