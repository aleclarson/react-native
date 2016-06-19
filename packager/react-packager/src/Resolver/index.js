/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const path = require('path');
const Promise = require('Promise');
const Activity = require('../Activity');
const DependencyGraph = require('../DependencyResolver/DependencyGraph');
const replacePatterns = require('../DependencyResolver/lib/replacePatterns');
const Polyfill = require('../DependencyResolver/Polyfill');
const declareOpts = require('../lib/declareOpts');

const validateOpts = declareOpts({
  internalRoots: {
    type: 'array',
    required: false,
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
  polyfillModuleNames: {
    type: 'array',
    default: [],
  },
  moduleFormat: {
    type: 'string',
    default: 'haste',
  },
  fileWatcher: {
    type: 'object',
    required: true,
  },
  cache: {
    type: 'object',
    required: true,
  },
});

const getDependenciesValidateOpts = declareOpts({
  dev: {
    type: 'boolean',
    default: true,
  },
  platform: {
    type: 'string',
    required: false,
  },
  isUnbundle: {
    type: 'boolean',
    default: false
  },
  recursive: {
    type: 'boolean',
    default: true,
  },
});

class Resolver {

  constructor(options) {
    const opts = validateOpts(options);

    this._depGraph = new DependencyGraph({
      internalRoots: opts.internalRoots,
      projectRoots: opts.projectRoots,
      projectExts: opts.projectExts,
      assetServer: opts.assetServer,
      fileWatcher: opts.fileWatcher,
      getBlacklist: opts.getBlacklist,
      cache: opts.cache,
      activity: Activity,
      platforms: ['ios', 'android'],
      preferNativePlatform: true,
      shouldThrowOnUnresolvedErrors: (_, platform) => platform === 'ios',
    });

    this._polyfillModuleNames = opts.polyfillModuleNames || [];

    this._depGraph.load().fail((err) => {
      // This only happens at initialization. Live errors are easier to recover from.
      console.log('Error building DependencyGraph:\n');
      console.log(err.stack);
      process.exit(1);
    });
  }

  getShallowDependencies(entryFile) {
    return this._depGraph.getShallowDependencies(entryFile);
  }

  stat(filePath) {
    return this._depGraph.getFS().stat(filePath);
  }

  getModuleForPath(entryFile) {
    return this._depGraph.getModuleForPath(entryFile);
  }

  getDependencies(main, options) {
    const opts = getDependenciesValidateOpts(options);

    return this._depGraph.getDependencies(
      main,
      opts.platform,
      opts.recursive,
    ).then(resolutionResponse => {
      this._getPolyfillDependencies().reverse().forEach(
        polyfill => resolutionResponse.prependDependency(polyfill)
      );

      return resolutionResponse.finalize();
    });
  }

  getModuleSystemDependencies(options) {
    const opts = getDependenciesValidateOpts(options);

    const prelude = opts.dev
        ? path.join(__dirname, 'polyfills/prelude_dev.js')
        : path.join(__dirname, 'polyfills/prelude.js');

    const moduleSystem = opts.isUnbundle
        ? path.join(__dirname, 'polyfills/require-unbundle.js')
        : path.join(__dirname, 'polyfills/require.js');

    return [
      prelude,
      moduleSystem
    ].map(moduleName => new Polyfill({
      path: moduleName,
      id: moduleName,
      dependencies: [],
      isPolyfill: true,
    }));
  }

  _getPolyfillDependencies() {
    const polyfillModuleNames = [
      path.join(__dirname, 'polyfills/polyfills.js'),
      path.join(__dirname, 'polyfills/error-guard.js'),
      path.join(__dirname, 'polyfills/String.prototype.es6.js'),
      path.join(__dirname, 'polyfills/Array.prototype.es6.js'),
      path.join(__dirname, 'polyfills/Array.es6.js'),
      path.join(__dirname, 'polyfills/Object.es7.js'),
      path.join(__dirname, 'polyfills/babelHelpers.js'),
    ].concat(this._polyfillModuleNames);

    return polyfillModuleNames.map(
      (polyfillModuleName, idx) => new Polyfill({
        path: polyfillModuleName,
        id: polyfillModuleName,
        dependencies: polyfillModuleNames.slice(0, idx),
        isPolyfill: true,
      })
    );
  }

  resolveRequires(resolutionResponse, module, code) {
    return Promise.try(() => {
      if (module.isPolyfill()) {
        return { code };
      }

      if (module.isNull()) {
        return {
          name: module.path,
          code: module.code,
        };
      }

      const resolvedDeps = Object.create(null);
      const resolvedDepsArr = [];

      return Promise.all(
        resolutionResponse.getResolvedDependencyPairs(module).map(
          ([depName, depModule]) => {
            if (depModule) {
              return depModule.getName().then(name => {
                resolvedDeps[depName] = name;
                resolvedDepsArr.push(name);
              });
            }
          }
        )
      ).then(() => {
        const relativizeCode = (codeMatch, pre, quot, depName, post) => {
          const depId = resolvedDeps[depName];
          if (depId) {
            return pre + quot + depId + post;
          } else {
            return codeMatch;
          }
        };

        code = code
          .replace(replacePatterns.IMPORT_RE, relativizeCode)
          .replace(replacePatterns.EXPORT_RE, relativizeCode)
          .replace(replacePatterns.REQUIRE_RE, relativizeCode);

        return module.getName().then(name => {
          return {name, code};
        });
      });
    });
  }

  wrapModule(resolutionResponse, module, code) {
    if (module.isPolyfill()) {
      return Promise({
        code: definePolyfillCode(code),
      });
    }

    return this.resolveRequires(resolutionResponse, module, code)
      .then(({name, code}) => {
        return {name, code: defineModuleCode(name, code)};
      });
  }

  getDebugInfo() {
    return this._depGraph.getDebugInfo();
  }
}

const moduleArgNames = ['global', 'require', 'module', 'exports'].join (', ');

function defineModuleCode(moduleName, code) {

  // Indent each line in the code block.
  code = code
    .split(log.ln)
    .map(code => '  ' + code)
    .join(log.ln);

  return [
    `__d(`,
    quoteWrap(moduleName),
    `, function(${moduleArgNames}) {`,
    log.ln,
    code,
    log.ln,
    `});`,
  ].join('');
}

function definePolyfillCode(code) {
  return [
    '(function(global) {',
    code,
    `\n})(typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this);`,
  ].join('');
}

function quoteWrap(string) {
  return '\'' + string + '\'';
}

module.exports = Resolver;
