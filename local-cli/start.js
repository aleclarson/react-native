
var lotus = require('lotus-require')
lotus.register();

require('../packager/babelRegisterOnly')([
  /private-cli\/src/,
  /local-cli/
]);

require('./server/server')(
  process.argv,
  require('./default.config')
);
