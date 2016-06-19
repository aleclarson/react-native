'use strict';

const AssetModule = require('./AssetModule');
const Package = require('./Package');
const Module = require('./Module');
const sync = require('sync');
const path = require('path');

class ModuleCache {

  constructor({
    fastfs,
    cache,
    extractRequires,
    transformCode,
  }) {
    this._moduleCache = Object.create(null);
    this._packageCache = Object.create(null);
    this._fastfs = fastfs;
    this._cache = cache;
    this._extractRequires = extractRequires;
    this._transformCode = transformCode;

    fastfs.on('change', this._processFileChange.bind(this));
  }

  getCachedModule(filePath) {
    return this._moduleCache[
      path.resolve(filePath).toLowerCase()
    ];
  }

  getModule(filePath) {
    filePath = path.resolve(filePath);

    const hash = filePath.toLowerCase();
    if (!this._moduleCache[hash]) {
      this._moduleCache[hash] = new Module({
        file: filePath,
        fastfs: this._fastfs,
        moduleCache: this,
        cache: this._cache,
        extractor: this._extractRequires,
        transformCode: this._transformCode,
      });
    }
    return this._moduleCache[id];
  }

  getAllModules() {
    return this._moduleCache;
  }

  getAssetModule(filePath) {
    filePath = path.resolve(filePath);

    const hash = filePath.toLowerCase();
    if (!this._moduleCache[hash]) {
      this._moduleCache[hash] = new AssetModule({
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

    const hash = filePath.toLowerCase();
    if (!this._packageCache[hash]) {
      this._packageCache[hash] = new Package({
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
