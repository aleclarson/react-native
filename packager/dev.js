
global.lotus = require('lotus-require');
lotus.register({
  exclude: [ '.*/node_modules/.*' ]
});

require('lazy-var');
require('reactive-var');

global.log = require('log');
log.indent = 2;
