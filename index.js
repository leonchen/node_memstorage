var fs = require('fs');

var DATA_FILE = "./storage.data";
var DATA = {"_": true};

var MS = function (options) {
  this.options = options || {};
  this.serving();
};

MS.prototype.serving = function () {
  this.dataFile = this.options.dataFile || DATA_FILE;
  this.setMode();
  this.initData();
  this.initSync();
};

MS.prototype.setMode = function () {
  if (this.options.mode == 'master') {
    this.writable = true;
    this.syncMode = 'sync';
    this.backupInterval = null;
  } else if (this.options.mode == 'slaver') {
    this.writable = false;
    this.syncMode = 'sync'; // backup|sync
    this.backupInterval = null;
  } else { // default will be standalone
    this.writable = this.options.writable || true;
    this.syncMode = this.options.syncModel || 'backup'; // backup|sync
    this.backupInterval = this.options.backupInterval || 60000;
  }
};

MS.prototype.initSync = function () {
  var self = this;
  if (this.syncMode == 'sync') {
    fs.watch(this.dataFile, function (e, filename) {
      //console.log('event:', e);
      if (e == 'change') self.loadData();
      if (e == 'rename') self.initData();
    });
  } else if (this.syncMode == 'backup') {
    var sync = function () {
      if (self.needSync && self.writable) fs.writeFileSync(self.dataFile, JSON.stringify(self._data));
      self.needSync = false;
      run();
    } 
    var run = function () {
      setTimeout(sync, self.backupInterval);
    };
    run();
  }
};

MS.prototype.initData = function () {
  if (!fs.existsSync(this.dataFile)) this.clear();
  this.loadData();
};

MS.prototype.loadData = function (key) {
  this._data = JSON.parse(fs.readFileSync(this.dataFile));
};

MS.prototype.get = function (key, cb) {
  var p = this.parse(key);
  if (p.err) return cb(p.err);
  return cb(null, p.obj[p.key]);
};

MS.prototype.set = function (key, value, cb) {
  var p = this.parse(key);
  if (p.err) return cb(p.err);
  p.obj[p.key] = value;
  this.syncData();
  cb(null);
};

MS.prototype.remove = function (key, cb) {
  var p = this.parse(key);
  if (p.err) return cb(p.err);
  delete p.obj[p.key];
  this.syncData();
  cb(null);
};

MS.prototype.clear = function (cb) {
  fs.writeFileSync(this.dataFile, JSON.stringify(DATA));
  this.syncData();
  if (cb) cb(null);
};

MS.prototype.syncData = function () {
  if (this.syncMode == 'sync') {
    if (this.writable) fs.writeFileSync(this.dataFile, JSON.stringify(this._data));
  } else {
    this.needSync = true;
  }
};

MS.prototype.parse = function (key) {
  if (!key.match(/\w\.\w/)) return { obj: this._data, key: key };

  var d = this._data;
  var keys = key.split(".");
  for (var i=0, l=keys.length-1; i<l; i++) {
    var k = keys[i];
    try {
      if (d[k] && (d[k] instanceof Object)) {
        d = d[k];
      } else {
        return { err: 'missing object: '+k };
      }
    } catch (e) {
      return { err: e };
    }
  }
  return { obj: d, key: keys[keys.length-1] };
};

module.exports = MS;
