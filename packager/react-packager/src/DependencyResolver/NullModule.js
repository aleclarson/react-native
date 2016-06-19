'use strict';

const Promise = require('Promise');
const Module = require('./Module');

class NullModule extends Module {
  constructor(opts) {
    super(opts);
    this.code = 'module.exports = null;';
  }

  isHaste() {
    return Promise(false);
  }

  getName() {
    return Promise(this.path);
  }

  getPackage() {
    return null;
  }

  getDependencies() {
    return Promise([]);
  }

  isJSON() {
    return false;
  }

  isNull() {
    return true;
  }
}

module.exports = NullModule;
