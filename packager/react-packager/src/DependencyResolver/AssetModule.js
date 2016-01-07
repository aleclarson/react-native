'use strict';

const Module = require('./Module');
const Q = require('q');
const getAssetDataFromName = require('../lib/getAssetDataFromName');

class AssetModule extends Module {
  constructor(...args) {
    super(...args);
    const { resolution, name, type } = getAssetDataFromName(this.path);
    this.resolution = resolution;
    this._name = name;
    this._type = type;

    log
      .moat(1)
      .white('AssetModule(')
      .yellow(this.path)
      .white(')')
      .moat(1);
  }

  isHaste() {
    return Q(false);
  }

  getDependencies() {
    return Q([]);
  }

  getAsyncDependencies() {
    return Q([]);
  }

  _read() {
    return Q({});
  }

  getName() {
    return super.getName().then(
      id => id.replace(/\/[^\/]+$/, `/${this._name}.${this._type}`)
    );
  }

  hash() {
    return `AssetModule : ${this.path}`;
  }

  isJSON() {
    return false;
  }

  isAsset() {
    return true;
  }
}

module.exports = AssetModule;
