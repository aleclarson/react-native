'use strict';

const isAbsolutePath = require('absolute-path');
const path = require('path');

class Package {

  constructor({ file, fastfs, cache }) {
    this.path = path.resolve(file);
    this.root = path.dirname(this.path);
    this._fastfs = fastfs;
    this.type = 'Package';
    this._cache = cache;
  }

  getMain() {
    return this.read().then(json => {
      const replacements = getReplacements(json);

      let main = json.main;
      if (typeof replacements === 'string') {
        main = replacements;
      }

      let ext;
      if (main) {
        ext = path.extname(main) || '.js';
        main = main.replace(/^\.\//, ''); // Remove leading dot-slash
        main = main.replace(/(\.js|\.json)$/, ''); // Remove trailing extension
      } else {
        ext = '.js';
        main = 'index';
      }

      if (replacements && typeof replacements === 'object') {
        main = replacements[main] ||
          replacements[main + ext] ||
          main;
      }

      if (ext) {
        main += ext;
      }

      return path.resolve(this.root, main);
    });
  }

  isHaste() {
    return this._cache.get(this.path, 'package-haste', () =>
      this.read().then(json => !!json.name)
    );
  }

  getName() {
    return this._cache.get(this.path, 'package-name', () =>
      this.read().then(json => json.name)
    );
  }

  _processFileChange() {
    this._cache.invalidate(this.path);
  }

  redirectRequire(name, resolveFilePath) {

    if (name[0] === '.') {
      throw new Error('Relative paths are not supported!');
    }

    return this.read().then(json => {
      let result;

      const replacements = getReplacements(json);
      if (!replacements || typeof replacements !== 'object') {
        return name;
      }

      // Module names can be redirected as is.
      if (name[0] !== path.sep) {
        result = replacements[name];
        if (result !== undefined) {
          return result;
        }
        return name;
      }

      // Returns undefined if no replacement exists.
      const redirect = (filePath) => {
        filePath = replacements[filePath];

        // Support disabling modules.
        if (filePath === false) {
          return null;
        }

        // Return an absolute path!
        if (typeof filePath === 'string') {
          return path.join(this.root, filePath);
        }
      }

      // Redirect absolute paths, but first convert it to a
      // path that is relative to the 'package.json' file!
      const relPath = './' + path.relative(this.root, name);

      // Try resolving as is.
      result = redirect(relPath);
      if (result !== undefined) {
        return result;
      }

      // This hook can be used to try to resolve
      // a relative path using different extensions.
      if (typeof resolveFilePath === 'function') {
        result = resolveFilePath(relPath, redirect);
        if (result !== undefined) {
          return result;
        }
      }

      // No replacement found.
      return name;
    });
  }

  read() {
    if (!this._reading) {
      this._reading = this._fastfs.readFile(this.path)
        .then(jsonStr => JSON.parse(jsonStr));
    }

    return this._reading;
  }
}

function getReplacements(pkg) {
  return pkg['react-native'] == null
    ? pkg.browser
    : pkg['react-native'];
}

module.exports = Package;
