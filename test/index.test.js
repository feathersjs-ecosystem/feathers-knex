/*jshint expr: true*/

import assert from 'assert';
import baseTests from 'feathers-service-tests';
import { errors } from 'feathers';
import service from '../src';

const options = {
  dialect: 'sqlite3',
  connection: {
    filename: './data.db'
  }
};

let _ids = {};
let people = service('people', options);

function clean(done) {
  people.knex.schema.dropTableIfExists('people').then(() => {
    people.knex.schema.createTable('people', table => {
      table.increments('id');
      table.string('name');
      table.integer('age');
    })
    .then(() => {
      done();
    });
  });
}

describe('Feathers Knex Service', () => {
  before(clean);
  after(clean);

  beforeEach(done => {
    people.create({
      name: 'Doug',
      age: 32
    }, {}, (error, data) => {
      if (error) {
        console.error(error);
      }

      _ids.Doug = data.id;
      done();
    });
  });

  afterEach(done => {
    people.remove(_ids.Doug, {}, (error) => {
      if (error) {
        console.error(error);
      }

      done();
    });
  });

  it('is CommonJS compatible', () => {
    assert.equal(typeof require('../lib'), 'function');
  });

  baseTests(people, _ids, errors.types);
});
