'use strict';

const AssetModule = require('./AssetModule');
const Package = require('./Package');
const Module = require('./Module');
const sync = require('sync');
const path = require('path');

class ModuleCache {

  constructor(fastfs, cache, extractRequires) {
    this._moduleCache = Object.create(null);
    this._packageCache = Object.create(null);
    this._fastfs = fastfs;
    this._cache = cache;
    this._extractRequires = extractRequires;
    fastfs.on('change', this._processFileChange.bind(this));
  }

  getModule(filePath) {
    filePath = path.resolve(filePath);
    const id = filePath.toLowerCase();
    if (!this._moduleCache[id]) {
      this._moduleCache[id] = new Module({
        file: filePath,
        fastfs: this._fastfs,
        moduleCache: this,
        cache: this._cache,
        extractor: this._extractRequires,
      });
    }
    return this._moduleCache[id];
  }

  getAssetModule(filePath) {
    filePath = path.resolve(filePath);
    const id = filePath.toLowerCase();
    if (!this._moduleCache[id]) {
      this._moduleCache[id] = new AssetModule({
        file: filePath,
        fastfs: this._fastfs,
        moduleCache: this,
        cache: this._cache,
      });
    }
    return this._moduleCache[id];
  }

  getPackage(filePath) {
    filePath = path.resolve(filePath);
    const id = filePath.toLowerCase();
    if (!this._packageCache[id]) {
      this._packageCache[id] = new Package({
        file: filePath,
        fastfs: this._fastfs,
        cache: this._cache,
      });
    }
    return this._packageCache[id];
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

    module.__package = packagePath.toLowerCase();
    return this.getPackage(packagePath);
  }

  removeModule(filePath) {
    const id = filePath.toLowerCase();
    delete this._moduleCache[id];
  }

  removePackage(filePath) {
    const id = filePath.toLowerCase();
    delete this._packageCache[id];
  }

  refresh() {
    log.moat(1);
    log.red('Refreshing the module cache!');
    log.moat(1);
    sync.each(this._moduleCache, (module) => {
      module._dependers = Object.create(null);
      module._dependencies = Object.create(null);
    });
    this._moduleCache = Object.create(null);
    this._cache.reset();
  }

  _processFileChange(type, filePath, root) {
    const id = path.join(root, filePath).toLowerCase();
    if (this._moduleCache[id]) {
      this._moduleCache[id]._processFileChange(type);
    }
    if (this._packageCache[id]) {
      this._packageCache[id]._processFileChange(type);
    }
  }
}

module.exports = ModuleCache;
