
global.lotus = require('lotus');
global.log = lotus.log;
global.color = log.color;

require('./babelRegisterOnly')([
  /packager\/[^\/]*/
]);

// Prevent babel from messing up the stack trace.
// require('stack').initialize()
// TODO: This causes an error when a bundle is requested.

// Make sure `lotus.file` exists.
require('./react-packager/src/DependencyResolver/lotusfs');

log.clear();
log.error.isPretty = false;
log.indent = 2;

log.moat(1);
log.it('lotus.parent = ' + color.yellow(lotus.parent.filename));
log.moat(1);
log.format(Object.keys(lotus.dependers), {
  label: 'lotus.dependers = ',
  unlimited: true
});
log.moat(1);

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
