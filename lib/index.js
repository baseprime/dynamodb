'use strict';

var _            = require('lodash'),
    util         = require('util'),
    AWS          = require('aws-sdk'),
    AWSDynamoDB  = require('aws-sdk/clients/dynamodb'),
    DocClient    = require('aws-sdk/lib/dynamodb/document_client'),
    Table        = require('./table'),
    Schema       = require('./schema'),
    serializer   = require('./serializer'),
    batch        = require('./batch'),
    Item         = require('./item'),
    createTables = require('./createTables'),
    bunyan       = require('bunyan');

var dynamo = module.exports;

var internals = {};

dynamo.AWS = AWS;
dynamo.log = bunyan.createLogger({
  name: 'dynamo',
  serializers : {err: bunyan.stdSerializers.err},
  level : bunyan.FATAL
});

dynamo.dynamoDriver = internals.dynamoDriver = function (driver) {
  if(driver) {
    internals.dynamodb = driver;

    var docClient = internals.loadDocClient(driver);
    internals.updateDynamoDBDocClientForAllModels(docClient);
  } else {
    internals.dynamodb = internals.dynamodb || new AWSDynamoDB({apiVersion: '2012-08-10'});
  }

  return internals.dynamodb;
};

dynamo.documentClient = internals.documentClient = function (docClient) {
  if(docClient) {
    internals.docClient = docClient;
    internals.dynamodb = docClient.service;
    internals.updateDynamoDBDocClientForAllModels(docClient);
  } else {
    internals.loadDocClient();
  }

  return internals.docClient;
};

internals.updateDynamoDBDocClientForAllModels = function (docClient) {
  _.each(dynamo.models, function (model) {
    model.config({docClient: docClient});
  });
};

internals.loadDocClient = function (driver) {
  if(driver) {
    internals.docClient = new DocClient({service : driver});
  } else {
    internals.docClient = internals.docClient || new DocClient({service : internals.dynamoDriver()});
  }

  return internals.docClient;
};

internals.compileModel = function (name, schema) {

  // extremly simple table names
  var tableName = name.toLowerCase() + 's';

  var log = dynamo.log.child({model: name});

  var table = new Table(tableName, schema, serializer, internals.loadDocClient(), log);

  var Model = function (attrs) {
    Item.call(this, attrs, table);
  };

  util.inherits(Model, Item);

  Model.get          = _.bind(table.get, table);
  Model.create       = _.bind(table.create, table);
  Model.update       = _.bind(table.update, table);
  Model.destroy      = _.bind(table.destroy, table);
  Model.query        = _.bind(table.query, table);
  Model.scan         = _.bind(table.scan, table);
  Model.parallelScan = _.bind(table.parallelScan, table);

  Model.getItems = batch(table, serializer).getItems;
  Model.batchGetItems = batch(table, serializer).getItems;

  // table ddl methods
  Model.createTable   = _.bind(table.createTable, table);
  Model.updateTable   = _.bind(table.updateTable, table);
  Model.describeTable = _.bind(table.describeTable, table);
  Model.deleteTable   = _.bind(table.deleteTable, table);
  Model.tableName     = _.bind(table.tableName, table);

  table.itemFactory = Model;

  Model.log = log;

  // hooks
  Model.after  = _.bind(table.after, table);
  Model.before = _.bind(table.before, table);

  /* jshint camelcase:false */
  Model.__defineGetter__('docClient', function(){
    return table.docClient;
  });

  Model.config = function(config) {
    config = config || {};

    if(config.tableName) {
      table.config.name = config.tableName;
    }

    if (config.docClient) {
      table.docClient = config.docClient;
    } else if (config.dynamodb) {
      table.docClient = new DocClient({ service : config.dynamodb});
    }

    return table.config;
  };

  return dynamo.model(name, Model);
};

internals.addModel = function (name, model) {
  dynamo.models[name] = model;

  return dynamo.models[name];
};

dynamo.reset = function () {
  dynamo.models = {};
};

dynamo.Set = function () {
  return internals.docClient.createSet.apply(internals.docClient, arguments);
};

dynamo.define = function (modelName, config) {
  if(_.isFunction(config)) {
    throw new Error('define no longer accepts schema callback, migrate to new api');
  }

  var schema = new Schema(config);

  var compiledTable = internals.compileModel(modelName, schema);

  return compiledTable;
};

dynamo.model = function(name, model) {
  if(model) {
    internals.addModel(name, model);
  }

  return dynamo.models[name] || null;
};

dynamo.createTables = function (options, callback) {
  if (typeof options === 'function' && !callback) {
    callback = options;
    options = {};
  }

  var promise;
  if (!callback && Promise) {
    promise = new Promise(function (resolve, reject) {
      callback = function (err, results) {
        err ? reject(err) : resolve(results);
      };
    });
  }

  callback = callback || _.noop;
  options = options || {};

  createTables(dynamo.models, options, callback);

  return promise;
};

dynamo.types = Schema.types;

dynamo.reset();
