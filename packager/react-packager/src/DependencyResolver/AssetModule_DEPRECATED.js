'use strict';

const Module = require('./Module');
const Q = require('q');
const getAssetDataFromName = require('../lib/getAssetDataFromName');

class AssetModule_DEPRECATED extends Module {
  constructor(...args) {
    super(...args);
    const {resolution, name} = getAssetDataFromName(this.path);
    this.resolution = resolution;
    this.name = name;

    log
      .moat(1)
      .white('AssetModule_DEPRECATED(')
      .yellow(this.path)
      .white(')')
      .moat(1);
  }

  isHaste() {
    return Q(false);
  }

  getName() {
    return Q(`image!${this.name}`);
  }

  getDependencies() {
    return Q([]);
  }

  getAsyncDependencies() {
    return Q([]);
  }

  hash() {
    return `AssetModule_DEPRECATED : ${this.path}`;
  }

  isJSON() {
    return false;
  }

  isAsset_DEPRECATED() {
    return true;
  }

  resolution() {
    return getAssetDataFromName(this.path).resolution;
  }

}

module.exports = AssetModule_DEPRECATED;
