/*jshint expr: true*/

import { expect } from 'chai';
import assert from 'assert';
import feathers from 'feathers';
import knex from 'knex';
import { base, example } from 'feathers-service-tests';
import { errors } from 'feathers-errors';
import service from '../src';
import server from '../example/app';

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

function clean() {
  return db.schema.dropTableIfExists('people')
    .then(() => db.schema.dropTableIfExists('people-customid'))
    .then(() =>
      db.schema.createTable('people', table => {
        table.increments('id');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
      }).then(() => db.schema.createTable('people-customid', table => {
        table.increments('customid');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
      }))
  );
}

describe('Feathers Knex Service', () => {
  const app = feathers().use('/people', service({
    Model: db,
    name: 'people',
    events: [ 'testing' ]
  })).use('/people-customid', service({
    Model: db,
    id: 'customid',
    name: 'people-customid',
    events: [ 'testing' ]
  }));

  before(clean);
  after(clean);

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () =>
        expect(service.bind(null))
          .to.throw('Knex options have to be provided')
      );
    });

    describe('when missing a Model', () => {
      it('throws an error', () =>
        expect(service.bind(null, {}))
          .to.throw(/You must provide a Model/)
      );
    });

    describe('when missing a table name', () => {
      it('throws an error', () =>
        expect(service.bind(null, { Model: {} }))
          .to.throw('No table name specified.')
      );
    });
  });

  describe('Common functionality', () => {
    it('is CommonJS compatible', () =>
      assert.equal(typeof require('../lib'), 'function')
    );

    base(app, errors, 'people');
    base(app, errors, 'people-customid', 'customid');
  });
});

describe('Knex service example test', () => {
  after(done => server.close(() => done()));

  example();
});
