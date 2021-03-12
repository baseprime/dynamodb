'use strict';

const Joi    = require('joi'),
    { v4: uuidv4, v1: uuidv1 } = require('uuid'),
    _        = require('lodash');

var internals =  {};

internals.secondaryIndexSchema = Joi.object().keys({
  hashKey : Joi.string().when('type', { is: 'local', then: Joi.ref('$hashKey'), otherwise : Joi.required()}),
  rangeKey: Joi.string().when('type', { is: 'local', then: Joi.required(), otherwise: Joi.optional() }),
  type : Joi.string().valid('local', 'global').required(),
  name : Joi.string().required(),
  projection : Joi.object(),
  readCapacity : Joi.number().when('type', { is: 'global', then: Joi.optional(), otherwise : Joi.forbidden()}),
  writeCapacity : Joi.number().when('type', { is: 'global', then: Joi.optional(), otherwise : Joi.forbidden()})
});

internals.configSchema = Joi.object().keys({
  hashKey   : Joi.string().required(),
  rangeKey  : Joi.string(),
  tableName : Joi.alternatives().try(Joi.string(), Joi.func()),
  indexes   : Joi.array().items(internals.secondaryIndexSchema),
  schema    : Joi.object(),
  timestamps : Joi.boolean().default(false),
  createdAt  : Joi.alternatives().try(Joi.string(), Joi.boolean()),
  updatedAt  : Joi.alternatives().try(Joi.string(), Joi.boolean())
}).required();

internals.wireType = function (key) {
  switch (key) {
    case 'string':
      return 'S';
    case 'date':
      return 'DATE';
    case 'number':
      return 'N';
    case 'boolean':
      return 'BOOL';
    case 'binary':
      return 'B';
    case 'array':
      return 'L';
    default:
      return null;
  }
};

internals.findDynamoTypeMetadata = function (data) {
  var meta = _.find(data.metas, function (data) {
    return _.isString(data.dynamoType);
  });

  if(meta) {
    return meta.dynamoType;
  } else {
    return internals.wireType(data.type);
  }
};

internals.parseDynamoTypes = function (data) {
  if (data.type === 'object') {
    if (data.keys === undefined) {
      return {};
    }

    return Object.entries(data.keys).reduce((res, [key, val]) => {
      res[key] = internals.parseDynamoTypes(val);
      return res;
    }, {});
  } 
  
  if (data.type === 'array' && (data.metas === undefined || data.metas.length < 1)) {
    return data.items === undefined ? internals.wireType('array') : data.items.map(item => internals.parseDynamoTypes(item));
  }

  return internals.findDynamoTypeMetadata(data);
};

var Schema = module.exports = function (config) {
  this.secondaryIndexes = {};
  this.globalIndexes = {};

  var context = {hashKey : config.hashKey};

  var self = this;
  var result = internals.configSchema.validate(config, { context: context });

  if(result.error) {
    var msg = 'Invalid table schema, check your config ';
    throw new Error(msg + result.error.annotate());
  }

  var data = result.value;
  self.hashKey    = data.hashKey;
  self.rangeKey   = data.rangeKey;
  self.tableName  = data.tableName;
  self.timestamps = data.timestamps;
  self.createdAt  = data.createdAt;
  self.updatedAt  = data.updatedAt;

  if(data.indexes) {
    self.globalIndexes    = _.chain(data.indexes).filter({ type: 'global' }).keyBy('name').value();
    self.secondaryIndexes = _.chain(data.indexes).filter({ type: 'local' }).keyBy('name').value();
  }

  if(data.schema) {
    self._modelSchema    = _.isPlainObject(data.schema) ? Joi.object().keys(data.schema) : data.schema;
  } else {
    self._modelSchema = Joi.object();
  }

  if(self.timestamps) {
    var valids = {};
    var createdAtParamName = 'createdAt';
    var updatedAtParamName = 'updatedAt';

    if(self.createdAt) {
      if(_.isString(self.createdAt)) {
        createdAtParamName = self.createdAt;
      }
    }

    if(self.updatedAt) {
      if(_.isString(self.updatedAt)) {
        updatedAtParamName = self.updatedAt;
      }
    }

    if(self.createdAt !== false) {
      valids[createdAtParamName] = Joi.date();
    }

    if(self.updatedAt !== false) {
      valids[updatedAtParamName] = Joi.date();
    }

    var extended = self._modelSchema.keys(valids);

    self._modelSchema = extended;
  }
  self._modelDatatypes = internals.parseDynamoTypes(self._modelSchema.describe());
};

Schema.types = {};

Schema.types.stringSet = function () {
  var set = Joi.array().items(Joi.string()).meta({dynamoType : 'SS'});

  return set;
};

Schema.types.numberSet = function () {
  var set = Joi.array().items(Joi.number()).meta({dynamoType : 'NS'});
  return set;
};

Schema.types.binarySet = function () {
  var set = Joi.array().items(Joi.binary(), Joi.string()).meta({dynamoType : 'BS'});
  return set;
};

// Functions which can accept a single argument must be wrapped to avoid the
// Joi context object from being passed as the first argument
//
// see :https://github.com/hapijs/joi/blob/v10.5.0/API.md#anydefaultvalue-description

const getUuidv4 = () => uuidv4();
getUuidv4.description = 'nodeUUID.v4()';
const getUuidv1 = () => uuidv1();
getUuidv1.description = 'nodeUUID.v1()';


Schema.types.uuid = function () {
  return Joi.string().guid({version : 'uuidv4'}).default(getUuidv4);
};

Schema.types.timeUUID = function () {
  return Joi.string().guid({version : 'uuidv1'}).default(getUuidv1);
};

Schema.prototype.validate = function (params, options) {
  options = options || {};

  return this._modelSchema.validate(params, options);
};

internals.invokeDefaultFunctions = function (data) {
  return _.mapValues(data, function (val) {
    if(_.isFunction(val)) {
      return val.call(null);
    } else if (_.isPlainObject(val)) {
      return internals.invokeDefaultFunctions(val);
    } else {
      return val;
    }
  });
};

Schema.prototype.applyDefaults = function (data) {
  var result = this.validate(data, {abortEarly : false});
  return internals.invokeDefaultFunctions(result.value);
};
