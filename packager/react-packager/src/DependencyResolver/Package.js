'use strict';

const isAbsolutePath = require('absolute-path');
const path = require('path');

const REDIRECT_EXTS = ['', '.js', '.json'];

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

      let ext;
      let main = json.main;
      const replacements = getReplacements(json);
      if (typeof replacements === 'string') {
        main = replacements;
      }

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

      if (!path.extname(main)) {
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

  redirectRequire(name) {
    return this.read().then(json => {
      var replacements = getReplacements(json);

      if (!replacements || typeof replacements !== 'object') {
        return name;
      }

      if (name[0] !== '/') {
        return replacements[name] || name;
      }

      if (!isAbsolutePath(name)) {
        throw new Error(`Expected ${name} to be absolute path`);
      }

      const relPath = './' + path.relative(this.root, name);

      for (let i = 0; i < REDIRECT_EXTS.length; i++) {

        let redirect = replacements[relPath + REDIRECT_EXTS[i]];

        if (redirect === false) {
          return null;
        }

        if (typeof redirect === 'string') {
          return path.join(
            this.root,
            redirect
          );
        }
      }

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
