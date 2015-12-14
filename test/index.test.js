/*jshint expr: true*/

import assert from 'assert';
import feathers from 'feathers';
import { base } from 'feathers-service-tests';
import { types as errors } from 'feathers-errors';
import service from '../src';

const options = {
  name: 'people',
  dialect: 'sqlite3',
  connection: {
    filename: './data.db'
  }
};
const app = feathers().use('/people', service(options));

let _ids = {};
let people = app.service('people');

function clean(done) {
  people.knex.schema.dropTableIfExists('people').then(() => {
    people.knex.schema.createTable('people', table => {
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

  beforeEach(done => {
    people.create({
      name: 'Doug',
      age: 32
    }).then(data => {
      _ids.Doug = data.id;
      done();
    }, done);
  });

  afterEach(done => people.remove(_ids.Doug, {})
    .then(() => done(), () => done()));

  it('is CommonJS compatible', () => {
    assert.equal(typeof require('../lib'), 'function');
  });

  base(people, _ids, errors);
});
