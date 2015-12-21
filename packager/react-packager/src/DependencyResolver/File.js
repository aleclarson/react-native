
const _ = require('underscore');
const path = require('path');
const {sync, async} = require('io');

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
      // var startTime = Date.now();
      this._read = async.read(this.path);
        // .always(() => {
        //   var readTime = (Date.now() - startTime) / 1000;
        //   if (readTime > 0.5) {
        //     log
        //       .moat(1)
        //       .gray.dim(this.path)
        //       .moat(0)
        //       .gray('Read time: ')
        //       .red(readTime)
        //       .moat(1);
        //   }
        // });
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
    return this._getFileFromPath(filePath);
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

  _getFileFromPath(filePath) {
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

  _createFileFromPath(filePath) {
    var file = this;
    const parts = path.relative(this.path, filePath).split(path.sep);
    parts.forEach((part, i) => {
      const newPath = file.path + "/" + part;
      var newFile = this._getFileFromPath(newPath);
      if (newFile == null) {
        let isDir = i < parts.length - 1;
        let isValid = isDir ? sync.isDir : sync.isFile;
        if (!isValid(newPath)) {
          let fileType = isDir ? 'directory' : 'file';
          throw Error('"' + newPath + '" is not a ' + fileType + ' that exists.');
        }
        newFile = new File(newPath, { isDir: isDir });
        file.addChild(newFile);

        if (isDir) {
          let pkgJsonPath = newPath + '/package.json';
          if (sync.isFile(pkgJsonPath)) {
            let pkgJson = new File(pkgJsonPath, { isDir: false });
            newFile.addChild(pkgJson);
          }
        }
      }
      file = newFile;
    });
    return file;
  }
}

module.exports = File;
