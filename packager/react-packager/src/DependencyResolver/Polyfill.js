'use strict';

const Promise = require('Promise');
const path = require('path');
const Module = require('./Module');

class Polyfill extends Module {
  constructor({ path, id, dependencies }) {
    super({ file: path });
    this._id = id;
    this._depNames = dependencies;
  }

  isHaste() {
    return Promise(false);
  }

  getName() {
    return Promise.try(() => {
      const name = this._id;
      if (name[0] === path.sep) {
        return path.relative(lotus.path, name);
      }
      return name;
    })
  }

  getPackage() {
    return null;
  }

  getDependencies() {
    return Promise(this._depNames);
  }

  isJSON() {
    return false;
  }

  isPolyfill() {
    return true;
  }
}

module.exports = Polyfill;
