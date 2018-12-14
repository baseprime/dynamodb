'use strict';

var util = require('util'),
    _    = require('lodash'),
    events = require('events');

var internals = {};

internals.identity = function () {};

var Item = module.exports = function (attrs, table) {
  events.EventEmitter.call(this);

  this.table = table;

  this.set(attrs || {});
};

util.inherits(Item, events.EventEmitter);

Item.prototype.get = function (key) {
  if(key) {
    return this.attrs[key];
  } else {
    return this.attrs;
  }
};

Item.prototype.set = function (params) {
  this.attrs = _.merge({}, this.attrs, params);

  return this;
};

Item.prototype.save = function (callback) {
  var self = this;
  
  var promise;
  if (!callback && Promise) {
    promise = new Promise(function (resolve, reject) {
      callback = function (err, results) {
        err ? reject(err) : resolve(results);
      };
    });
  }

  callback = callback || internals.identity;

  self.table.create(this.attrs, function (err, item) {
    if(err) {
      return callback(err);
    }

    self.set(item.attrs);

    return callback(null, item);
  });

  return promise;
};

Item.prototype.update = function (options, callback) {
  var self = this;

  if (typeof options === 'function' && !callback) {
    callback = options;
    options = {};
  }

  options = options || {};

  var promise;
  if (!callback && Promise) {
    promise = new Promise(function (resolve, reject) {
      callback = function (err, results) {
        err ? reject(err) : resolve(results);
      };
    });
  }

  callback = callback || internals.identity;

  self.table.update(this.attrs, options, function (err, item) {
    if(err) {
      return callback(err);
    }

    if(item) {
      self.set(item.attrs);
    }

    return callback(null, item);
  });

  return promise;
};

Item.prototype.destroy = function (options, callback) {
  var self = this;

  if (typeof options === 'function' && !callback) {
    callback = options;
    options = {};
  }

  options = options || {};

  var promise;
  if (!callback && Promise) {
    promise = new Promise(function (resolve, reject) {
      callback = function (err, results) {
        err ? reject(err) : resolve(results);
      };
    });
  }

  callback = callback || internals.identity;

  self.table.destroy(this.attrs, options, callback);

  return promise;
};

Item.prototype.toJSON = function() {
  return _.cloneDeep(this.attrs);
};
