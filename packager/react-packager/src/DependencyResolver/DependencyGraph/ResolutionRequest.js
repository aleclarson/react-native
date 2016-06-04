 /**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const debug = require('debug')('ReactNativePackager:DependencyGraph');

const Q = require('q');
const util = require('util');
const path = require('path');
const syncFs = require('io/sync');
const inArray = require ('in-array');
const NODE_PATHS = require('node-paths');
const isAbsolutePath = require('absolute-path');

const Module = require('../Module');
const NullModule = require('../NullModule');
const globalConfig = require('../../GlobalConfig');
const getAssetDataFromName = require('../lib/getAssetDataFromName');

class ResolutionRequest {
  constructor({
    platform,
    preferNativePlatform,
    projectExts,
    entryPath,
    fastfs,
    hasteMap,
    assetServer,
    moduleCache,
    ignoreFilePath,
    shouldThrowOnUnresolvedErrors,
  }) {
    this._platform = platform;
    this._preferNativePlatform = preferNativePlatform;
    this._projectExts = projectExts;
    this._entryPath = entryPath;
    this._fastfs = fastfs;
    this._hasteMap = hasteMap;
    this._assetServer = assetServer;
    this._moduleCache = moduleCache;
    this._ignoreFilePath = ignoreFilePath;
    this._shouldThrowOnUnresolvedErrors = shouldThrowOnUnresolvedErrors;
  }

  resolveDependency(fromModule, toModuleName) {
    return Q.try(() =>
      this._resolveAssetDependency(toModuleName) ||
        this._resolveJSDependency(fromModule, toModuleName))

    .then(resolvedModule => {
      if (this._ignoreFilePath(resolvedModule.path)) {
        return null;
      }
      fromModule.resolveDependency(toModuleName, resolvedModule);
      return resolvedModule;
    })

    .fail(error => {
      log.moat(1);
      log.red('Failed to resolve: ');
      log.white(toModuleName);
      log.moat(0);
      log.gray('  fromModule = ');
      log.white(path.relative(lotus.path, fromModule.path));
      log.moat(0);
      log.gray.dim(
        error.stack
          .split(log.ln)
          .slice(1) // Remove the first line.
          .join(log.ln)
      );
      log.moat(1);
      if (this._shouldThrowOnUnresolvedErrors(this._entryPath, this._platform)) {
        throw error;
      }
    });
  }

  getOrderedDependencies(response, mocksPattern) {
    return this._getAllMocks(mocksPattern).then(mocks => {
      response.setMocks(mocks);

      const entry = this._moduleCache.getModule(this._entryPath);
      const visited = Object.create(null);
      visited[entry.hash()] = true;

      let failed = false;

      const collect = (mod) => {

        response.pushDependency(mod);

        log.cyan.dim('•');
        if (log.line.length == 50) {
          log.moat(0);
        }

        return mod.getDependencies()

        .then(depNames => {
          const promises = depNames.map(name => {
            return Q.try(() => {
              const result = mod.resolveDependency(name);
              if (result) {
                return result;
              }
              return this.resolveDependency(mod, name)
              .fail(error => {
                failed = true;
                if (error.type !== 'UnableToResolveError') {
                  throw error;
                }
              })
              .then(result => {
                if (log.isDebug) {
                  log.moat(1);
                  log.gray('fromModule = ');
                  log.white(path.relative(lotus.path, mod.path));
                  log.moat(0);
                  log.gray('requirePath = ');
                  log.yellow(name);
                  log.moat(0);
                  log.gray('resolvedPath = ');
                  if (result) {
                    log.green(path.relative(lotus.path, result.path));
                  } else {
                    log.yellow('null');
                  }
                  log.moat(1);
                }
                return result;
              });
            });
          });

          return Q.all(promises)
          .then(dependencies => [
            depNames,
            dependencies,
          ]);
          // .always(() => {
          //   return mod.getName().then(name =>{
          //     log.moat(1);
          //     log.white(name, ' ');
          //     log.cyan(depNames.length);
          //     log.moat(1);
          //   });
          // });
        })

        .then(([depNames, dependencies]) => {
          if (mocks) {
            return mod.getName().then(name => {
              if (mocks[name]) {
                const mockModule =
                  this._moduleCache.getModule(mocks[name]);
                depNames.push(name);
                dependencies.push(mockModule);
              }
              return [depNames, dependencies];
            });
          }
          return Q([depNames, dependencies]);
        })

        .then(([depNames, dependencies]) => {
          let queue = Q();
          const filteredPairs = [];

          dependencies.forEach((modDep, i) => {
            const name = depNames[i];
            if (modDep == null) {
              // It is possible to require mocks that don't have a real
              // module backing them. If a dependency cannot be found but there
              // exists a mock with the desired ID, resolve it and add it as
              // a dependency.
              if (mocks && mocks[name]) {
                const mockModule = this._moduleCache.getModule(mocks[name]);
                return filteredPairs.push([name, mockModule]);
              }

              if (log.isDebug) {
                log.moat(1);
                log.red(name, ' ');
                log.white('cannot be found!');
                log.moat(0);
                log.gray('fromModule = ');
                log.gray.dim(path.relative(lotus.path, mod.path));
                log.moat(1);
              }
              return;
            }
            return filteredPairs.push([name, modDep]);
          });

          response.setResolvedDependencyPairs(mod, filteredPairs);

          filteredPairs.forEach(([depName, modDep]) => {
            queue = queue.then(() => {
              const hash = modDep.hash();
              if (!visited[hash]) {
                visited[hash] = true;
                return collect(modDep);
              }
            });
          });

          return queue;
        });
      };

      return collect(entry);
    });
  }

  getAsyncDependencies(response) {
    return Q().then(() => {
      const mod = this._moduleCache.getModule(this._entryPath);
      return mod.getAsyncDependencies().then(bundles =>
        Q.all(bundles.map(bundle =>
          Q.all(bundle.map(
            dep => this.resolveDependency(mod, dep)
          ))
        ))
        .then(bs => bs.map(bundle => bundle.map(dep => dep.path)))
      );
    }).then(asyncDependencies => asyncDependencies.forEach(
      (dependency) => response.pushAsyncDependency(dependency)
    ));
  }

  _resolveJSDependency(fromModule, toModuleName) {
    return Q.all([
      toModuleName,
      this._redirectRequire(fromModule, toModuleName)
    ])
    .then(([oldModuleName, toModuleName]) => {

      if (toModuleName === null) {
        return this._getNullModule(oldModuleName, fromModule);
      }

      if (globalConfig.redirect[toModuleName] !== undefined) {
        let oldModuleName = toModuleName;
        toModuleName = globalConfig.redirect[toModuleName];
        if (toModuleName === false) {
          return this._getNullModule(oldModuleName, fromModule);
        }
        toModuleName = globalConfig.resolve(toModuleName);
      }

      return this._tryResolve(
        () => this._resolveHasteDependency(fromModule, toModuleName),
        () => this._resolveNodeDependency(fromModule, toModuleName),
      );
    });
  }

  _resolveAssetDependency(toModuleName) {
    const assetPath = this._assetServer.resolve(toModuleName, this._fastfs);
    if (assetPath) {
      return this._moduleCache.getAssetModule(assetPath);
    }
  }

  _resolveHasteDependency(fromModule, toModuleName) {

    if (!this._isModuleName(toModuleName)) {
      throw new UnableToResolveError();
    }

    let dep = this._hasteMap.getModule(toModuleName, this._platform);
    if (dep && dep.type === 'Module') {
      return dep;
    }

    // Find the package of a path like 'fbjs/src/Module.js' or 'fbjs'.
    let packageName = toModuleName;
    while (packageName && packageName !== '.') {
      dep = this._hasteMap.getModule(packageName, this._platform);
      if (dep && dep.type === 'Package') {
        break;
      }
      packageName = path.dirname(packageName);
    }

    if (dep && dep.type === 'Package') {
      if (toModuleName === packageName) {
        return this._loadAsDir(dep.root, fromModule, toModuleName);
      }
      const filePath = path.join(
        dep.root,
        path.relative(packageName, toModuleName)
      );
      return this._tryResolve(
        () => this._loadAsFile(filePath, fromModule, toModuleName),
        () => this._loadAsDir(filePath, fromModule, toModuleName),
      );
    }

    throw new UnableToResolveError();
  }

  _resolveNodeDependency(fromModule, toModuleName) {

    return this._resolveLotusPath(
      fromModule,
      toModuleName,
    )

    .then(filePath => {

      if (filePath) {
        return this._moduleCache.getModule(filePath);
      }

      if (this._isModuleName(toModuleName)) {

        // If a module from the Node.js standard library is imported,
        // default to a "null module" unless a polyfill exists.
        if (inArray(NODE_PATHS, toModuleName)) {
          return this._getNullModule(
            toModuleName,
            fromModule,
          );
        }

        // Search each 'node_modules' directory.
        return this._findInstalledModule(
          fromModule,
          toModuleName,
        );
      }

      throw new UnableToResolveError();
    });
  }

  _resolveLotusPath(fromModule, toModuleName) {

    const resolve = (filePath) => {
      filePath = lotus.resolve(filePath, fromModule.path);
      if (filePath) {
        return filePath;
      }
    };

    // Convert relative paths to absolutes.
    if (toModuleName[0] === '.') {
      toModuleName = path.resolve(
        path.dirname(fromModule.path),
        toModuleName
      );

      // Try coercing './MyClass' into './MyClass/index'
      const toModulePath = this._resolveFilePath(
        toModuleName + '/index',
        resolve
      );
      if (toModulePath) {
        return Q(toModulePath);
      }
    }

    // Prepend $LOTUS_PATH to any module names.
    else if (toModuleName[0] !== path.sep) {
      toModuleName = path.join(lotus.path, toModuleName);
    }

    if (syncFs.isDir(toModuleName)) {
      return this._resolvePackageMain(toModuleName)
        .then(mainPath => this._resolveFilePath(mainPath, resolve));
    }

    return Q.fulfill(
      this._resolveFilePath(toModuleName, resolve)
    );
  }

  _resolvePackageMain(dirPath) {
    const pkgPath = path.join(dirPath, 'package.json');
    if (this._fileExists(pkgPath)) {
      return this._moduleCache.getPackage(pkgPath).getMain();
    }
    return Q.fulfill(
      path.join(dirPath, 'index')
    );
  }

  // Try resolving a path with platform-specific variants.
  _resolvePlatformVariant(filePath, ext, resolver) {

    let result = resolver(filePath + '.' + this._platform + ext);
    if (result !== undefined) {
      return result;
    }

    if (this._preferNativePlatform) {
      result = resolver(filePath + '.native' + ext);
      if (result !== undefined) {
        return result;
      }
    }

    result = resolver(filePath + ext);
    if (result !== undefined) {
      return result;
    }
  }

  // Attempts to resolve the given `filePath` by trying
  // multiple extensions until a result is returned
  // by the `resolver` function.
  _resolveFilePath(filePath, resolver) {

    // If an extension is provided, don't try the default extensions.
    const ext = path.extname(filePath);
    if (ext) {
      return this._resolvePlatformVariant(
        filePath.slice(0, 0 - ext.length),
        ext,
        resolver
      );
    }

    // Try each default extension.
    const exts = this._projectExts;
    for (let i = 0; i < exts.length; i++) {
      let result = this._resolvePlatformVariant(
        filePath,
        '.' + exts[i],
        resolver
      );
      if (result !== undefined) {
        return result;
      }
    }
  }

  _findInstalledModule(fromModule, toModuleName) {
    const searchQueue = [];
    const isNodeModulesDir = /node_modules$/g;

    let dirPath = path.dirname(fromModule.path);
    while (dirPath !== path.sep) {

      // Never try 'node_modules/node_modules'
      if (isNodeModulesDir.test(dirPath)) {
        continue;
      }

      searchQueue.push(
        path.join(dirPath, 'node_modules', toModuleName)
      );

      dirPath = path.dirname(dirPath);
    }

    let promise = Q.reject(new UnableToResolveError());
    searchQueue.forEach(filePath => {
      promise = promise.fail((error) => {
        if (error.type !== 'UnableToResolveError') {
          throw error;
        }
        return this._tryResolve(
          () => this._loadAsFile(filePath, fromModule, toModuleName),
          () => this._loadAsDir(filePath, fromModule, toModuleName),
        );
      });
    });

    return promise;
  }

  _redirectRequire(fromModule, toModuleName) {

    const pkg = fromModule.getPackage();
    if (!pkg) {
      return Q(toModuleName);
    }

    let absPath = toModuleName;
    if (toModuleName[0] === '.') {
      absPath = path.resolve(
        path.dirname(fromModule.path),
        toModuleName
      );
    }

    return pkg.redirectRequire(
      absPath,
      this._resolveFilePath.bind(this)
    )

    .then(redirect =>
      redirect === absPath ?
        toModuleName : redirect);
  }

  _loadAsFile(filePath, fromModule, toModule) {
    let result = this._resolveFilePath(filePath, (filePath) => {
      try {
        if (this._fileExists(filePath)) {
          return this._moduleCache.getModule(filePath);
        }
      } catch (error) {
        if (error.code === 404) { return }
        throw error;
      }
    });
    if (result !== undefined) {
      return result;
    }
    throw new UnableToResolveError();
  }

  _loadAsDir(dirPath, fromModule, toModule) {
    if (!this._dirExists(dirPath)) {
      throw new UnableToResolveError();
    }
    return this._resolvePackageMain(dirPath)
      .then(mainPath => this._loadAsFile(mainPath, fromModule, toModule));
  }

  _fileExists(filePath) {
    const root = this._fastfs._getRoot(filePath);
    if (root == null) {
      return false;
    }
    if (root.isDetached) {
      return syncFs.isFile(filePath);
    }
    return this._fastfs.fileExists(filePath);
  }

  _dirExists(filePath) {
    const root = this._fastfs._getRoot(filePath);
    if (root == null) {
      return false;
    }
    if (root.isDetached) {
      return syncFs.isDir(filePath);
    }
    return this._fastfs.dirExists(filePath);
  }

  _tryResolve(action, secondaryAction) {
    return Q.try(() => action())
    .fail((error) => {
      if (error.type !== 'UnableToResolveError') {
        throw error;
      }
      return secondaryAction();
    });
  }

  _isModuleName(filePath) {
    const firstChar = filePath[0];
    return firstChar !== '.' && firstChar !== path.sep;
  }

  _getNullModule(modulePath, fromModule) {

    if (typeof modulePath !== 'string') {
      throw TypeError('Expected "modulePath" to be a String');
    }

    const moduleCache = this._moduleCache._moduleCache;

    if (modulePath[0] === '.') {
      modulePath = path.resolve(
        path.resolve(fromModule.path),
        modulePath
      );
    }

    modulePath += '_NULL';
    let module = moduleCache[modulePath];

    if (!module) {
      module = moduleCache[modulePath] = new NullModule({
        file: modulePath,
        fastfs: this._fastfs,
        moduleCache: this._moduleCache,
        cache: this._moduleCache._cache,
      });
    }

    return module;
  }

  _getAllMocks(pattern) {
    // Take all mocks in all the roots into account. This is necessary
    // because currently mocks are global: any module can be mocked by
    // any mock in the system.
    let mocks = null;
    if (pattern) {
      mocks = Object.create(null);
      this._fastfs.matchFilesByPattern(pattern).forEach(file =>
        mocks[path.basename(file, path.extname(file))] = file
      );
    }
    return Q(mocks);
  }
}

function UnableToResolveError() {
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  this.type = this.name = 'UnableToResolveError';
}

util.inherits(UnableToResolveError, Error);

module.exports = ResolutionRequest;
