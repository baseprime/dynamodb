'use strict';

var async = require('async'),
    _     = require('lodash');

var internals = {};

internals.createTable = function (model, options, callback) {
  options = options || {};

  model.describeTable(function (err, data) {
    if(_.isNull(data) || _.isUndefined(data)) {
      return model.createTable(options, function (error) {

        if(error) {
          return callback(error);
        }

        internals.waitTillActive(model, callback);
      });
    } else {
      model.updateTable(function (err) {
        if(err) {
          return callback(err);
        }

        internals.waitTillActive(model, callback);
      });
    }
  });
};

internals.waitTillActive = function (model, callback) {
  var status = 'PENDING';

  async.doWhilst(
    function (callback) {
    model.describeTable(function (err, data) {
      if(err) {
        return callback(err);
      }

      status = data.Table.TableStatus;

      setTimeout(callback, 1000);
    });
  },
  function () { return status !== 'ACTIVE'; },
  function (err) {
    return callback(err);
  });
};

module.exports = function (models, config, callback) {
  async.eachSeries(_.keys(models), function (key, callback) {
    return internals.createTable(models[key], config[key], callback);
  }, callback);
};
