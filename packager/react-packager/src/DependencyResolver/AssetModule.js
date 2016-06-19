'use strict';

const Module = require('./Module');
const getAssetDataFromName = require('./lib/getAssetDataFromName');

class AssetModule extends Module {
  constructor(...args) {
    super(...args);
    const { resolution, name, type } = getAssetDataFromName(this.path);
    this.resolution = resolution;
    this._name = name;
    this._type = type;
  }

  isHaste() {
    return Promise(false);
  }

  getDependencies() {
    return Promise([]);
  }

  getAsyncDependencies() {
    return Promise([]);
  }

  read() {
    return Promise({});
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
