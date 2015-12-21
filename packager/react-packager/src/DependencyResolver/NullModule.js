'use strict';

const Q = require('q');
const Module = require('./Module');

class NullModule extends Module {
  constructor(file, fastfs, moduleCache, cache) {
    super(file, fastfs, moduleCache, cache);
    this.code = 'module.exports = null;';
  }

  isHaste() {
    return Q(false);
  }

  getName() {
    return Q(this.path);
  }

  getPackage() {
    return null;
  }

  getDependencies() {
    return Q([]);
  }

  isJSON() {
    return false;
  }

  isNull() {
    return true;
  }
}

module.exports = NullModule;
