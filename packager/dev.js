
global.lotus = require('lotus-require');
global.log = require('lotus-log');

require('./babelRegisterOnly')([
  /packager\/[^\/]*/
]);

// Make sure `lotus.file` exists.
require('./react-packager/src/DependencyResolver/lotusfs');

log.clear();
log.error.isQuiet = false;
log.error.isPretty = false;
log.indent = 2;

var KeyBindings = require('key-bindings');

var keys = KeyBindings({
  'c+ctrl': function() {
    log.moat(1);
    log.red('CTRL+C');
    log.moat(1);
    process.exit(0);
  }
});

keys.stream = process.stdin;
