'use strict';

const isAbsolutePath = require('absolute-path');
const path = require('path');

const REDIRECT_EXTS = ['', '.js', '.json'];

class Package {

  constructor(file, fastfs, cache) {
    this.path = path.resolve(file);
    this.root = path.dirname(this.path);
    this._fastfs = fastfs;
    this.type = 'Package';
    this._cache = cache;
  }

  getMain() {
    return this._read().then(json => {
      if (typeof json.browser === 'string') {
        return path.join(this.root, json.browser);
      }

      let main = json.main || 'index';

      if (json.browser && typeof json.browser === 'object') {
        main = json.browser[main] ||
          json.browser[main + '.js'] ||
          json.browser[main + '.json'] ||
          json.browser[main.replace(/(\.js|\.json)$/, '')] ||
          main;
      }

      return path.join(this.root, main);
    });
  }

  isHaste() {
    return this._cache.get(this.path, 'package-haste', () =>
      this._read().then(json => !!json.name)
    );
  }

  getName() {
    return this._cache.get(this.path, 'package-name', () =>
      this._read().then(json => json.name)
    );
  }

  invalidate() {
    this._cache.invalidate(this.path);
  }

  redirectRequire(name) {
    return this._read().then(json => {
      var {browser} = json;

      if (!browser || typeof browser !== 'object') {
        return name;
      }

      if (name[0] !== '/') {
        return browser[name] || name;
      }

      if (!isAbsolutePath(name)) {
        throw new Error(`Expected ${name} to be absolute path`);
      }

      const relPath = './' + path.relative(this.root, name);

      for (let i = 0; i < REDIRECT_EXTS.length; i++) {

        let redirect = browser[relPath + REDIRECT_EXTS[i]];

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

  _read() {
    if (!this._reading) {
      this._reading = this._fastfs.readFile(this.path)
        .then(jsonStr => JSON.parse(jsonStr));
    }

    return this._reading;
  }
}

module.exports = Package;
