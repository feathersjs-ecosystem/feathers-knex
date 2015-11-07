/*jshint expr: true*/

import chai from 'chai';
import service from '../src';
import baseTests from 'feathers-service-tests';

const options = {
  dialect: 'sqlite3',
  connection: {
    filename: './data.db'
  }
};

let expect = chai.expect;
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

  describe('init', () => {
    describe('without table', () => {
      it('throws an error', () => {
        expect(service).to.throw('No table name specified.');
      });
    });

    describe.skip('with table', () => {
      it('sets up a database connection via config', () => {
        // expect(service).to.throw('No table name specified.');
      });

      it('sets up a database connection via connection string', () => {
        // expect(service).to.throw('No table name specified.');
      });

      it('sets up a database connection via socket config', () => {
        // expect(service).to.throw('No table name specified.');
      });
    });
  });

  baseTests(people, _ids);
});
