/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const isAbsolutePath = require('absolute-path');
const sync = require('sync');
const path = require('path');

const docblock = require('./DependencyGraph/docblock');
const extractRequires = require('./lib/extractRequires');

class Module {

  constructor({ file, fastfs, moduleCache, cache, extractor }) {
    if (file[0] === '.') {
      throw Error('Path cannot be relative: ' + file);
    }

    this.path = file;
    this.type = 'Module';

    this._fastfs = fastfs;
    this._moduleCache = moduleCache;
    this._cache = cache;
    this._extractor = extractor;

    this._dependers = Object.create(null);
    this._dependencies = Object.create(null);
  }

  isHaste() {
    return this._cache.get(
      this.path,
      'isHaste',
      () => this.read().then(data => !!data.id)
    );
  }

  getName() {
    return this._cache.get(
      this.path,
      'name',
      () => this.read().then(data => {
        if (data.id) {
          return data.id;
        }

        const p = this.getPackage();

        if (!p) {
          // Name is full path
          return this.path;
        }

        return p.getName()
          .then(name => {
            if (!name) {
              return this.path;
            }

            return path.join(name, path.relative(p.root, this.path)).replace(/\\/g, '/');
          });
      })
    );
  }

  getPackage() {
    return this._moduleCache.getPackageForModule(this);
  }

  getDependencies() {
    return this._cache.get(
      this.path,
      'dependencies',
      () => this.read().then(data => data.dependencies)
    );
  }

  getAsyncDependencies() {
    return this._cache.get(
      this.path,
      'asyncDependencies',
      () => this.read().then(data => data.asyncDependencies)
    );
  }

  // Get or set a resolved dependency.
  resolveDependency(name, mod) {
    const hash = this.path + ':' + name;
    if (!mod) {
      return this._dependencies[hash];
    }
    mod._dependers[hash] = this;
    this._dependencies[hash] = mod;
  }

  invalidate() {
    this._cache.invalidate(this.path);
  }

  read() {
    if (!this._reading) {
      this._reading = this._fastfs.readFile(this.path).then(content => {
        const data = {};
        const moduleDocBlock = docblock.parseAsObject(content);
        if (moduleDocBlock.providesModule || moduleDocBlock.provides) {
          data.id = /^(\S*)/.exec(
            moduleDocBlock.providesModule || moduleDocBlock.provides
          )[1];
        }

        // Ignore requires in JSON files or generated code. An example of this
        // is prebuilt files like the SourceMap library.
        if (this.isJSON() || 'extern' in moduleDocBlock) {
          data.dependencies = [];
          data.asyncDependencies = [];
        } else {
          var dependencies = (this._extractor || extractRequires)(content).deps;
          data.dependencies = dependencies.sync;
          data.asyncDependencies = dependencies.async;
        }

        // log
        //   .moat(1)
        //   .white('Found dependencies: ')
        //   .yellow(this.path)
        //   .moat(0)
        //   .format(data.dependencies)
        //   .moat(1);

        return data;
      });
    }

    return this._reading;
  }

  hash() {
    return `Module : ${this.path}`;
  }

  isJSON() {
    return path.extname(this.path) === '.json';
  }

  isAsset() {
    return false;
  }

  isPolyfill() {
    return false;
  }

  isNull() {
    return false;
  }

  isAsset_DEPRECATED() {
    return false;
  }

  toJSON() {
    return {
      hash: this.hash(),
      isJSON: this.isJSON(),
      isAsset: this.isAsset(),
      isAsset_DEPRECATED: this.isAsset_DEPRECATED(),
      type: this.type,
      path: this.path,
    };
  }

  _processFileChange(type) {

    var newModule;

    // Force this Module to recache its data.
    this._cache.invalidate(this.path);

    // Remove this Module from its ModuleCache.
    this._moduleCache.removeModule(this.path);

    // Any old dependencies should NOT have this Module
    // in their `_dependers` hash table.
    sync.each(this._dependencies, (mod, hash) => {
      delete mod._dependers[hash];
    });

    if (type === 'delete') {

      // Catch other Modules still depending on this deleted Module.
      sync.each(this._dependers, (mod, hash) => {
        delete mod._dependencies[hash];
      });

    } else {

      // Force the ModuleCache to regenerate this Module.
      newModule = this._moduleCache.getModule(this.path);

      // Force any Modules (that depend on the old Module)
      // to depend on the new Module.
      sync.each(this._dependers, (mod, hash) => {
        mod._dependencies[hash] = newModule;
        newModule._dependers[hash] = mod;
      });
    }
  }
}

module.exports = Module;
