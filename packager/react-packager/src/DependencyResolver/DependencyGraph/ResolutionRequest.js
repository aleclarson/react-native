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

const isAbsolutePath = require('absolute-path');
const NODE_PATHS = require('node-paths');
const inArray = require ('in-array');
const syncFs = require('io/sync');
const path = require('path');
const util = require('util');

const getAssetDataFromName = require('../lib/getAssetDataFromName');
const globalConfig = require('../../GlobalConfig');
const NullModule = require('../NullModule');
const Module = require('../Module');

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
    return Promise.try(() =>
      this._resolveAssetDependency(toModuleName) ||
        this._resolveJSDependency(fromModule, toModuleName))

    .then(resolvedModule => {
      if (!resolvedModule || this._ignoreFilePath(resolvedModule.path)) {
        return null;
      }
      fromModule.setDependency(toModuleName, resolvedModule);
      return resolvedModule;
    })

    .fail(error => {
      log.moat(1);
      log.red('Failed to resolve: ');
      log.white(toModuleName);
      log.moat(0);
      log.gray('  fromModule = ');
      log.white(path.relative(lotus.path, fromModule.path));
      log.moat(1);
      if (this._shouldThrowOnUnresolvedErrors(this._entryPath, this._platform)) {
        throw error;
      }
    });
  }

  getOrderedDependencies(response, mocksPattern) {
    return this._getAllMocks(mocksPattern).then(allMocks => {
      const entry = this._moduleCache.getModule(this._entryPath);
      const mocks = Object.create(null);
      const visited = Object.create(null);

      visited[entry.hash()] = true;
      response.pushDependency(entry);

      let failed = false;
      const collect = (mod) => {

        response.pushDependency(mod);

        log.cyan.dim('•');
        if (log.line.length == 50) {
          log.moat(0);
        }

        return mod.getDependencies()

        .then(depNames => {
          return Promise.map(depNames, (name) => {
            const result = mod.getDependency(name);
            if (result) {
              return result;
            }

            return this.resolveDependency(mod, name)

            .fail(error => {
              failed = true;
              console.log(error.stack);
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
          })
          .then(dependencies => [
            depNames,
            dependencies,
          ]);
        })

        .then(([depNames, dependencies]) => {
          if (allMocks) {
            return mod.getName().then(name => {
              if (allMocks) {
                const names = [mod.getName()];
                const pkg = mod.getPackage();
                pkg && names.push(pkg.getName());
                return Promise.all(names).then(names => {
                  names.forEach(name => {
                    if (allMocks[name] && !mocks[name]) {
                      const mockModule =
                        this._moduleCache.getModule(allMocks[name]);
                      depNames.push(name);
                      dependencies.push(mockModule);
                      mocks[name] = allMocks[name];
                    }
                  });
                  return [depNames, dependencies];
                });
              }
              return [depNames, dependencies];
            });
          }
          return [depNames, dependencies];
        })

        .then(([depNames, dependencies]) => {
          let queue = Promise();
          const filteredPairs = [];

          dependencies.forEach((modDep, i) => {
            const name = depNames[i];
            if (modDep == null) {
              // It is possible to require mocks that don't have a real
              // module backing them. If a dependency cannot be found but there
              // exists a mock with the desired ID, resolve it and add it as
              // a dependency.
              if (allMocks && allMocks[name] && !mocks[name]) {
                const mockModule = this._moduleCache.getModule(allMocks[name]);
                mocks[name] = allMocks[name];
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
              return false;
            }
            return filteredPairs.push([name, modDep]);
          });

          response.setResolvedDependencyPairs(mod, filteredPairs);

          filteredPairs.forEach(([depName, modDep]) => {
            queue = queue.then(() => {
              const hash = modDep.hash();
              if (!visited[hash]) {
                visited[hash] = true;
                response.pushDependency(modDep);
                if (recursive) {
                  return collect(modDep);
                }
              }
            });
          });

          return queue;
        });
      };

      return collect(entry)

      .then(() => response.setMocks(mocks));
    });
  }

  getAsyncDependencies(response) {
    return Promise().then(() => {
      const mod = this._moduleCache.getModule(this._entryPath);
      return mod.getAsyncDependencies().then(bundles =>
        Promise.all(bundles.map(bundle =>
          Promise.all(bundle.map(
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
    return Promise.all([
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
    })
    .fail(error => {
      log.moat(1);
      log.gray.dim(error.stack);
      log.moat(1);
    })
  }

  _resolveAssetDependency(toModuleName) {
    const assetPath = this._assetServer.resolve(toModuleName, this._fastfs);
    if (assetPath) {
      return this._moduleCache.getAssetModule(assetPath);
    }
  }

  _resolveHasteDependency(fromModule, toModuleName) {

    if (!this._isModuleName(toModuleName)) {
      throw UnableToResolveError(toModuleName);
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
      return Promise.try(() => {
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
      })
      .fail(error => {
        if (error.type !== 'UnableToResolveError') {
          throw error;
        }
        throw UnableToResolveError(toModuleName);
      });
    }

    throw UnableToResolveError(toModuleName);
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

      throw UnableToResolveError(toModuleName);
    });
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
        return Promise(toModulePath);
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

    return Promise(
      this._resolveFilePath(toModuleName, resolve)
    );
  }

  _resolvePackageMain(dirPath) {
    const pkgPath = path.join(dirPath, 'package.json');
    if (this._fileExists(pkgPath)) {
      return this._moduleCache.getPackage(pkgPath).getMain();
    }
    return Promise(
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

    let promise = Promise.reject(
      UnableToResolveError(toModuleName)
    );

    searchQueue.forEach(filePath => {
      promise = promise.fail(error => {
        if (error.type !== 'UnableToResolveError') {
          throw error;
        }
        return this._tryResolve(
          () => this._loadAsFile(filePath, fromModule, toModuleName),
          () => this._loadAsDir(filePath, fromModule, toModuleName),
        );
      });
    });

    promise.fail(error => {
      console.log('Failed to resolve: ' + toModuleName);
      if (error.type !== 'UnableToResolveError') {
        throw error;
      }
      throw UnableToResolveError(toModuleName);
    });

    return promise;
  }

  _redirectRequire(fromModule, toModuleName) {

    const pkg = fromModule.getPackage();
    if (!pkg) {
      return Promise(toModuleName);
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
        if (error.code !== 404) {
          throw error;
        }
      }
    });
    if (result !== undefined) {
      return result;
    }
    return Promise.reject(
      UnableToResolveError(filePath)
    );
  }

  _loadAsDir(dirPath, fromModule, toModule) {
    if (!this._dirExists(dirPath)) {
      return Promise.reject(
        UnableToResolveError(dirPath)
      );
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
    return Promise.try(() => action())
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
    return Promise(mocks);
  }
}

function UnableToResolveError(path) {
  var error = Error('Failed to resolve: ' + path);
  error.type = 'UnableToResolveError';
  return error;
}

module.exports = ResolutionRequest;
