
require('./babelRegisterOnly')([
  /local-cli/
]);

var createServer = require('./server/server');
createServer(process.argv, require('./default.config'));
