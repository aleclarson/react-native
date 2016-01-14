'use strict';

const AssetModule = require('./AssetModule');
const Package = require('./Package');
const Module = require('./Module');
const {sync} = require('io');
const path = require('path');

class ModuleCache {

  constructor(fastfs, cache) {
    this._moduleCache = Object.create(null);
    this._packageCache = Object.create(null);
    this._fastfs = fastfs;
    this._cache = cache;
    fastfs.on('change', this._processFileChange.bind(this));
  }

  getModule(filePath) {
    filePath = path.resolve(filePath);
    if (!this._moduleCache[filePath]) {
      this._moduleCache[filePath] = new Module(
        filePath,
        this._fastfs,
        this,
        this._cache,
      );
    }
    return this._moduleCache[filePath];
  }

  getAssetModule(filePath) {
    filePath = path.resolve(filePath);
    if (!this._moduleCache[filePath]) {
      this._moduleCache[filePath] = new AssetModule(
        filePath,
        this._fastfs,
        this,
        this._cache,
      );
    }
    return this._moduleCache[filePath];
  }

  getPackage(filePath) {
    filePath = path.resolve(filePath);
    if (!this._packageCache[filePath]){
      this._packageCache[filePath] = new Package(
        filePath,
        this._fastfs,
        this._cache,
      );
    }
    return this._packageCache[filePath];
  }

  getPackageForModule(module) {
    // TODO(amasad): use ES6 Map.
    if (module.__package) {
      if (this._packageCache[module.__package]) {
        return this._packageCache[module.__package];
      } else {
        delete module.__package;
      }
    }

    const packagePath = this._fastfs.closest(module.path, 'package.json');

    if (!packagePath) {
      return null;
    }

    module.__package = packagePath;
    return this.getPackage(packagePath);
  }

  removeModule(filePath) {
    delete this._moduleCache[filePath];
  }

  removePackage(filePath) {
    delete this._packageCache[filePath];
  }

  refresh() {
    log
      .moat(1)
      .red('Refreshing the module cache!')
      .moat(1);
    sync.each(this._moduleCache, (module) => {
      module._dependers = null;
      module._dependencies = null;
    });
    this._moduleCache = Object.create(null);
    this._cache.reset();
  }

  _processFileChange(type, filePath, root) {
    const absPath = path.join(root, filePath);
    if (this._moduleCache[absPath]) {
      this._moduleCache[absPath]._processFileChange(type);
    }
    if (this._packageCache[absPath]) {
      this._packageCache[absPath]._processFileChange(type);
    }
  }
}

module.exports = ModuleCache;
