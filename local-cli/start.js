
require('./babelRegisterOnly')([
  /local-cli/
]);

require('./server/server')(process.argv);
