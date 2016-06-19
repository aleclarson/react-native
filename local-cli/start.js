
require('../packager/babelRegisterOnly')([
  /private-cli\/src/,
  /local-cli/
]);

var createServer = require('./server/server');
createServer(process.argv, require('./default.config'));
