
const _ = require('underscore');
const path = require('path');
const {async} = require('io');

class File {
  constructor(filePath, { isDir }) {
    this.path = filePath;
    this.isDir = Boolean(isDir);
    if (this.isDir) {
      this.children = Object.create(null);
    }
  }

  read() {
    if (!this._read) {
      this._read = async.read(this.path);
    }
    return this._read;
  }

  stat() {
    if (!this._stat) {
      this._stat = async.stats(this.path);
    }

    return this._stat;
  }

  addChild(file) {
    const parts = path.relative(this.path, file.path).split(path.sep);

    if (parts.length === 0) {
      return;
    }

    if (parts.length === 1) {
      this.children[parts[0]] = file;
      file.parent = this;
    } else if (this.children[parts[0]]) {
      this.children[parts[0]].addChild(file);
    } else {
      const dir = new File(path.join(this.path, parts[0]), { isDir: true });
      dir.parent = this;
      this.children[parts[0]] = dir;
      dir.addChild(file);
    }
  }

  getFileFromPath(filePath) {
    const parts = path.relative(this.path, filePath)
            .split(path.sep);

    /*eslint consistent-this:0*/
    let file = this;
    for (let i = 0; i < parts.length; i++) {
      let fileName = parts[i];
      if (!fileName) {
        continue;
      }

      if (!file || !file.isDir) {
        // File not found.
        return null;
      }

      file = file.children[fileName];
    }

    return file;
  }

  getFiles() {
    return _.flatten(_.values(this.children).map(file => {
      if (file.isDir) {
        return file.getFiles();
      } else {
        return file;
      }
    }));
  }

  ext() {
    return path.extname(this.path).replace(/^\./, '');
  }

  remove() {
    if (!this.parent) {
      throw new Error(`No parent to delete ${this.path} from`);
    }

    delete this.parent.children[path.basename(this.path)];
  }
}

module.exports = File;
