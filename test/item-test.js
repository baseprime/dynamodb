'use strict';

var Item   = require('../lib/item'),
    Table  = require('../lib/table'),
    Schema = require('../lib/schema'),
    chai   = require('chai'),
    expect = chai.expect,
    assert = chai.assert,
    helper = require('./test-helper'),
    serializer = require('../lib/serializer'),
    Joi    = require('joi');

chai.should();

describe('item', function() {
  var table;

  beforeEach(function () {
    var config = {
      hashKey: 'num',
      schema : {
        num : Joi.number(),
        name : Joi.string()
      }
    };

    var schema = new Schema(config);

    table = new Table('mockTable', schema, serializer, helper.mockDocClient());
  });

  it('JSON.stringify should only serialize attrs', function() {
    var attrs = {num: 1, name: 'foo'};
    var item = new Item(attrs, table);
    var stringified = JSON.stringify(item);

    stringified.should.equal(JSON.stringify(attrs));
  });

  describe('#save', function () {

    it('should return error', function (done) {
      table.docClient.put.yields(new Error('fail'));

      var attrs = {num: 1, name: 'foo'};
      var item = new Item(attrs, table);

      item.save(function (err, data) {
        expect(err).to.exist;
        expect(data).to.not.exist;

        return done();
      });

      it('should reject an error with a promise', function (done) {
        table.docClient.put.yields(new Error('fail'));

        var attrs = {num: 1, name: 'foo'};
        var item = new Item(attrs, table);

        item.save()
          .then(function () {
            assert(false, 'then should not be called');
          })
          .catch(function (err) {
            expect(err).to.exist;

            return done();
          });
      });
    });

  });

  describe('#update', function () {
    it('should return item', function (done) {
      table.docClient.update.yields(null, {Attributes : {num : 1, name : 'foo'}});

      var attrs = {num: 1, name: 'foo'};
      var item = new Item(attrs, table);

      item.update(function (err, data) {
        expect(err).to.not.exist;
        expect(data.get()).to.eql({ num : 1, name : 'foo'});

        return done();
      });
    });

    it('should resolve to an item with a promise', function (done) {
      table.docClient.update.yields(null, {Attributes : {num : 1, name : 'foo'}});

      var attrs = {num: 1, name: 'foo'};
      var item = new Item(attrs, table);

      item.update()
        .then(function (data) {
          expect(data.get()).to.eql({ num : 1, name : 'foo'});

          return done();
        })
        .catch(function () {
          assert(false, 'catch should not be called');
        });
    });


    it('should return error', function (done) {
      table.docClient.update.yields(new Error('fail'));

      var attrs = {num: 1, name: 'foo'};
      var item = new Item(attrs, table);

      item.update(function (err, data) {
        expect(err).to.exist;
        expect(data).to.not.exist;

        return done();
      });

    });

    it('should return null', function (done) {
      table.docClient.update.yields(null, {});

      var attrs = {num: 1, name: 'foo'};
      var item = new Item(attrs, table);

      item.update(function (err, data) {
        expect(err).to.not.exist;
        expect(data).to.not.exist;

        return done();
      });
    });

  });
});
