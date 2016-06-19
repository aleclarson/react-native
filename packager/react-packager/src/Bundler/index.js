/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const syncFs = require('io/sync');
const path = require('path');
const Promise = require('Promise');
const BundlesLayout = require('../BundlesLayout');
const Cache = require('../DependencyResolver/Cache');
const Transformer = require('../JSTransformer');
const Resolver = require('../Resolver');
const Bundle = require('./Bundle');
const PrepackBundle = require('./PrepackBundle');
const Activity = require('../Activity');
const ModuleTransport = require('../lib/ModuleTransport');
const declareOpts = require('../lib/declareOpts');
const imageSize = require('image-size');
const version = require('../../../../package.json').version;

const sizeOf = Promise.ify(imageSize);
const readFile = Promise.ify(fs.readFile);

const validateOpts = declareOpts({
  internalRoots: {
    type: 'array',
    required: true,
  },
  projectRoots: {
    type: 'array',
    required: true,
  },
  projectExts: {
    type: 'array',
    required: true,
  },
  assetServer: {
    type: 'object',
    required: true,
  },
  getBlacklist: {
    type: 'function',
    default: () => null,
  },
  moduleFormat: {
    type: 'string',
    default: 'haste',
  },
  polyfillModuleNames: {
    type: 'array',
    default: [],
  },
  cacheVersion: {
    type: 'string',
    default: '1.0',
  },
  resetCache: {
    type: 'boolean',
    default: false,
  },
  transformModulePath: {
    type:'string',
    required: false,
  },
  nonPersistent: {
    type: 'boolean',
    default: false,
  },
  fileWatcher: {
    type: 'object',
    required: true,
  },
  transformTimeoutInterval: {
    type: 'number',
    required: false,
  },
  disableInternalTransforms: {
    type: 'boolean',
    default: false,
  },
});

class Bundler {

  constructor(options) {
    const opts = this._opts = validateOpts(options);

    opts.projectRoots.forEach(verifyRootExists);

    let mtime;
    try {
      ({mtime} = fs.statSync(opts.transformModulePath));
      mtime = String(mtime.getTime());
    } catch (error) {
      mtime = '';
    }

    this._cache = new Cache({
      resetCache: opts.resetCache,
      cacheKey: [
        'react-packager-cache',
        version,
        opts.cacheVersion,
        opts.projectRoots.join(',').split(path.sep).join('-'),
        mtime
      ].join('$'),
    });

    this._resolver = new Resolver({
      internalRoots: opts.internalRoots,
      projectRoots: opts.projectRoots,
      projectExts: opts.projectExts,
      assetServer: opts.assetServer,
      getBlacklist: opts.getBlacklist,
      polyfillModuleNames: opts.polyfillModuleNames,
      moduleFormat: opts.moduleFormat,
      fileWatcher: opts.fileWatcher,
      cache: this._cache,
    });

    this._bundlesLayout = new BundlesLayout({
      dependencyResolver: this._resolver,
      resetCache: opts.resetCache,
      cacheVersion: opts.cacheVersion,
      projectRoots: opts.projectRoots,
    });

    this._transformer = new Transformer({
      projectRoots: opts.projectRoots,
      cache: this._cache,
      fastfs: this._resolver._depGraph._fastfs,
      transformModulePath: opts.transformModulePath,
      disableInternalTransforms: opts.disableInternalTransforms,
    });

    this._projectRoots = opts.projectRoots;
    this._assetServer = opts.assetServer;

    if (opts.getTransformOptionsModulePath) {
      this._getTransformOptionsModule = require(opts.getTransformOptionsModulePath);
    }
  }

  kill() {
    this._transformer.kill();
    return this._cache.end();
  }

  getLayout(main, isDev) {
    return this._bundlesLayout.generateLayout(main, isDev);
  }

  bundle({
    entryFile,
    runModule: runMainModule,
    runBeforeMainModule,
    sourceMapUrl,
    dev: isDev,
    platform,
    unbundle: isUnbundle,
    hot: hot,
  }) {
    // Const cannot have the same name as the method (babel/babel#2834)
    const bbundle = new Bundle(sourceMapUrl);
    const findEventId = Activity.startEvent('find dependencies');
    let transformEventId;

    const moduleSystem = this._resolver.getModuleSystemDependencies(
      { dev: isDev, platform, isUnbundle }
    );

    return this.getDependencies(entryFile, isDev, platform).then(response => {

      // Prepend the module system polyfill to the top of dependencies
      const dependencies = moduleSystem.concat(response.dependencies);

      // Promises that resolve into a name/path pair.
      const namedModules = dependencies.map(module => {
        return module.getName().then(name => {
          return {
            name,
            path: path.relative(
              lotus.path,
              module.path,
            ),
          }
        })
      });

      bbundle.setMainModuleId(response.mainModuleId);
      bbundle.setNumPrependedModules(
        response.numPrependedDependencies + moduleSystem.length
      );

      return Promise.all(namedModules).then(namedModules => {

        log.moat(1);
        log.white('Total dependencies: ');
        log.yellow(dependencies.length -
          (response.numPrependedDependencies + moduleSystem.length));
        log.moat(1);

        syncFs.write(
          lotus.path + '/.ReactNativeModules.json',
          JSON.stringify(namedModules, null, 2)
        );

        Activity.endEvent(findEventId);
        transformEventId = Activity.startEvent('transform dependencies');

        // Promises that are transforming their module.
        const transforming = dependencies.map(module => {
          return this._transformModule(
            bbundle,
            response,
            module,
            platform,
            hot,
          )
          .then(transformed => {
            return this._wrapTransformedModule(
              response,
              module,
              transformed,
            );
          })
        });

        return Promise.all(transforming)

        .then(transformedModules => {
          Activity.endEvent(transformEventId);
          return transformedModules;
        })
      })
    })

    .then(transformedModules => {
      transformedModules.forEach(function(moduleTransport) {
        bbundle.addModule(moduleTransport);
      });

      bbundle.finalize({runBeforeMainModule, runMainModule});
      return bbundle;
    });
  }

  prepackBundle({
    entryFile,
    runModule: runMainModule,
    runBeforeMainModule,
    sourceMapUrl,
    dev: isDev,
    platform,
  }) {
    const bundle = new PrepackBundle(sourceMapUrl);
    const findEventId = Activity.startEvent('find dependencies');
    let transformEventId;
    let mainModuleId;

    return Promise.try(() => {
      return this.getDependencies(entryFile, isDev, platform)
    })

    .then((response) => {

      mainModuleId = response.mainModuleId;

      const promises = [];
      response.dependencies.forEach(module => {
        const pairs = response.getResolvedDependencyPairs(module);
        const deps = Object.create(null);
        if (pairs) {
          log.moat(1);
          log.yellow(path.relative(lotus.path, module.path));
          log.plusIndent(2);
          pairs.forEach(pair => {
            deps[pair[0]] = pair[1].path;
            log.moat(0);
            log.gray.dim(pair[0] + ' ');
            log.white(path.relative(lotus.path, pair[1].path));
          });
          log.popIndent();
          log.moat(1);
        }
        const promise = this._transformModule(
          bundle,
          response,
          module,
          platform
        )
        .then(transformed => {
          return module.getName().then(name => {
            bundle.addModule(name, transformed, deps, module.isPolyfill());
          });
        });
        promises.push(promise);
      });

      Activity.endEvent(findEventId);
      transformEventId = Activity.startEvent('transform');
      return Promise.all(promises);
    })

    .then(() => {
      Activity.endEvent(transformEventId);
      bundle.finalize({runBeforeMainModule, runMainModule, mainModuleId });
      return bundle;
    });
  }

  bundleForHMR({entryFile, platform, modules}) {
    return this.getDependencies(entryFile, /*isDev*/true, platform)
      .then(response => {
        return Promise.all(
          modules.map(module => {
            return Promise.all([
              module.getName(),
              this._transformModuleForHMR(module, platform),
            ]).then(([moduleName, transformed]) => {
              return this._resolver.resolveRequires(response,
                module,
                transformed.code,
              ).then(({name, code}) => {
                return (`
                  __accept(
                    '${moduleName}',
                    function(global, require, module, exports) {
                      ${code}
                    }
                  );
                `);
              });
            });
          })
        );
      })
      .then(modules => modules.join('\n'));
  }

  _transformModuleForHMR(module, platform) {
    if (module.isAsset()) {
      return this._generateAssetObjAndCode(module, platform).then(
        ({asset, code}) => {
          return {
            code,
          };
        }
      );
    } else {
      return this._transformer.loadFileAndTransform(
        module.path,
        // TODO(martinb): pass non null main (t9527509)
        this._getTransformOptions({main: null}, {hot: true}),
      );
    }
  }

  invalidateFile(filePath) {
    this._transformer.invalidateFile(filePath);
  }

  getShallowDependencies(entryFile) {
    return this._resolver.getShallowDependencies(entryFile);
  }

  stat(filePath) {
    return this._resolver.stat(filePath);
  }

  getModuleForPath(entryFile) {
    return this._resolver.getModuleForPath(entryFile);
  }

  getDependencies(main, isDev, platform) {
    return this._resolver.getDependencies(main, { dev: isDev, platform });
  }

  getOrderedDependencyPaths({ entryFile, dev, platform }) {
    return this.getDependencies(entryFile, dev, platform).then(
      ({ dependencies }) => {

        const ret = [];
        const promises = [];
        const placeHolder = {};
        dependencies.forEach(dep => {
          if (dep.isAsset()) {
            const relPath = getPathRelativeToRoot(
              this._projectRoots,
              dep.path
            );
            promises.push(
              this._assetServer.getAssetData(relPath, platform)
            );
            ret.push(placeHolder);
          } else {
            ret.push(dep.path);
          }
        });

        return Promise.all(promises).then(assetsData => {
          assetsData.forEach(({ files }) => {
            const index = ret.indexOf(placeHolder);
            ret.splice(index, 1, ...files);
          });
          return ret;
        });
      }
    );
  }

  _transformModule(bundle, response, module, platform = null, hot = false) {

    // TODO Strip null references entirely?
    //      ie: Replace `require()` with `null`
    if (module.isNull()) {
      return Promise({
        sourceCode: module.code,
        sourcePath: module.path,
      });
    }

    if (module.isAsset()) {
      return this._generateAssetModule(bundle, module, platform);
    }

    if (module.isJSON()) {
      return generateJSONModule(module);
    }

    return this._transformer.loadFileAndTransform(
      path.resolve(module.path),
      this._getTransformOptions(
        {bundleEntry: bundle.getMainModuleId(), modulePath: module.path},
        {hot: hot},
      ),
    );
  }

  _wrapTransformedModule(response, module, transformed) {
    return this._resolver.wrapModule(
      response,
      module,
      transformed.code
    ).then(
      ({code, name}) => new ModuleTransport({
        code,
        name,
        map: transformed.map,
        sourceCode: transformed.sourceCode,
        sourcePath: transformed.sourcePath,
        virtual: transformed.virtual,
      })
    );
  }

  refreshModuleCache() {
    return this._resolver.refreshModuleCache();
  }

  getGraphDebugInfo() {
    return this._resolver.getDebugInfo();
  }

  _generateAssetObjAndCode(module, platform = null) {
    const relPath = getPathRelativeToRoot(this._projectRoots, module.path);
    var assetUrlPath = path.join('/assets', path.dirname(relPath));

    // On Windows, change backslashes to slashes to get proper URL path from file path.
    if (path.sep === '\\') {
      assetUrlPath = assetUrlPath.replace(/\\/g, '/');
    }

    return Promise.all([
      sizeOf(module.path),
      this._assetServer.getAssetData(relPath, platform),
    ]).then(function(res) {
      const dimensions = res[0];
      const assetData = res[1];
      const asset = {
        __packager_asset: true,
        fileSystemLocation: path.dirname(module.path),
        httpServerLocation: assetUrlPath,
        width: dimensions.width / module.resolution,
        height: dimensions.height / module.resolution,
        scales: assetData.scales,
        files: assetData.files,
        hash: assetData.hash,
        name: assetData.name,
        type: assetData.type,
      };

      const ASSET_TEMPLATE = 'module.exports = require("AssetRegistry").registerAsset(%json);';
      const code = ASSET_TEMPLATE.replace('%json', JSON.stringify(asset));

      return {asset, code};
    });
  }

  _generateAssetModule(bundle, module, platform = null) {
    return this._generateAssetObjAndCode(module, platform).then(({asset, code}) => {
      bundle.addAsset(asset);
      return new ModuleTransport({
        code: code,
        sourceCode: code,
        sourcePath: module.path,
        virtual: true,
      });
    });
  }

  _getTransformOptions(config, options) {
    const transformerOptions = this._getTransformOptionsModule
      ? this._getTransformOptionsModule(config)
      : null;

    return {...options, ...transformerOptions};
  }
}

function generateJSONModule(module) {
  return readFile(module.path).then(function(data) {
    const code = 'module.exports = ' + data.toString('utf8') + ';';

    return new ModuleTransport({
      code: code,
      sourceCode: code,
      sourcePath: module.path,
      virtual: true,
    });
  });
}

function getPathRelativeToRoot(roots, absPath) {
  for (let i = 0; i < roots.length; i++) {
    const relPath = path.relative(roots[i], absPath);
    if (relPath[0] !== '.') {
      return relPath;
    }
  }

  throw new Error(
    'Expected root module to be relative to one of the project roots'
  );
}

function verifyRootExists(root) {
  // Verify that the root exists.
  assert(fs.statSync(root).isDirectory(), 'Root has to be a valid directory');
}

class DummyCache {
  get(filepath, field, loaderCb) {
    return loaderCb();
  }

  end(){}
  invalidate(filepath){}
}
module.exports = Bundler;
