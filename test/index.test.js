import { expect } from 'chai';
import assert from 'assert';
import feathers from 'feathers';
import hooks from 'feathers-hooks';
import knex from 'knex';
import { base, example } from 'feathers-service-tests';
import { errors } from 'feathers-errors';

import service from '../src';
import server from '../example/app';

const { transaction } = service.hooks;

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

const people = service({
  Model: db,
  name: 'people',
  events: [ 'testing' ]
});

const peopleId = service({
  Model: db,
  id: 'customid',
  name: 'people-customid',
  events: [ 'testing' ]
});

function clean () {
  return people.init({}, (table) => {
    table.increments('id');
    table.string('name');
    table.integer('age');
    table.integer('time');
    table.boolean('created');
    return table;
  })
  .then(() => {
    return peopleId.init({}, (table) => {
      table.increments('customid');
      table.string('name');
      table.integer('age');
      table.integer('time');
      table.boolean('created');
      return table;
    });
  });
}

describe('Feathers Knex Service', () => {
  const app = feathers()
    .configure(hooks())
    .hooks({
      before: transaction.start(),
      after: transaction.end(),
      error: transaction.rollback()
    })
    .use('/people', people)
    .use('people-customid', peopleId);
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

  describe('$like method', () => {
    beforeEach(done => {
      app.service('/people').create({
        name: 'Charlie Brown',
        age: 10
      }, done);
    });

    it('$like in query', () => {
      return app.service('/people').find({
        query: { name: { $like: '%lie%' } }
      }).then(data => {
        expect(data[0].name).to.be.equal('Charlie Brown');
      });
    });
  });
});

describe('Knex service example test', () => {
  after(done => server.close(() => done()));

  example();
});
