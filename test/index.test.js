/*jshint expr: true*/

import { expect } from 'chai';
import assert from 'assert';
import feathers from 'feathers';
import knex from 'knex';
import { base, orm, example } from 'feathers-service-tests';
import { errors } from 'feathers-errors';
import service from '../src';
import server from '../example/app';

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

const app = feathers().use('/people', service({
  Model: db,
  name: 'people'
}));

let _ids = {};
let people = app.service('people');

function clean(done) {
  db.schema.dropTableIfExists('people').then(() => {
    db.schema.createTable('people', table => {
      table.increments('id');
      table.string('name');
      table.integer('age');
      table.integer('time');
      table.boolean('created');
    })
    .then(() => {
      done();
    });
  });
}

describe('Feathers Knex Service', () => {
  before(clean);
  after(clean);

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () => {
        expect(service.bind(null)).to.throw('Knex options have to be provided');
      });
    });

    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw(/You must provide a Model/);
      });
    });

    describe('when missing a table name', () => {
      it('throws an error', () => {
        expect(service.bind(null, { Model: {} })).to.throw('No table name specified.');
      });
    });

    describe('when missing the id option', () => {
      it('sets the default to be id', () => {
        expect(people.id).to.equal('id');
      });
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () => {
        expect(people.paginate).to.deep.equal({});
      });
    });
  });

  describe('Common functionality', () => {
    beforeEach(done => {
      people.create({
        name: 'Doug',
        age: 32
      }).then(data => {
        _ids.Doug = data.id;
        done();
      }, done);
    });

    afterEach(done => {
      people.remove(_ids.Doug, {}).then(() => done(), () => done());
    });

    it('is CommonJS compatible', () => {
      assert.equal(typeof require('../lib'), 'function');
    });

    base(people, _ids, errors);
  });
});

describe.skip('Knex service ORM errors', () => {
  orm(people, _ids, errors);
});

describe('Knex service example test', () => {
  after(done => server.close(() => done()));

  example();
});
