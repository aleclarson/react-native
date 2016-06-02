'use strict';

const Q = require('q');
const path = require('path');
const Module = require('./Module');

class Polyfill extends Module {
  constructor({ path, id, dependencies }) {
    super({ file: path });
    this._id = id;
    this._depNames = dependencies;
  }

  isHaste() {
    return Q(false);
  }

  getName() {
    return Q.try(() => {
      const name = this._id;
      if (name[0] === '/') {
        return path.relative(lotus.path, name);
      }
      return name;
    })
  }

  getPackage() {
    return null;
  }

  getDependencies() {
    return Q(this._depNames);
  }

  isJSON() {
    return false;
  }

  isPolyfill() {
    return true;
  }
}

module.exports = Polyfill;
