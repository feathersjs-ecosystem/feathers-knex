/*jshint expr: true*/

import chai from 'chai';
import service from '../src';
import feathers from 'feathers';

const options = {
  dialect: 'sqlite3',
  connection: {
    filename: './data.db'
  }
};

let expect = chai.expect;
let errors = feathers.errors.types;
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

    describe('get', () => {
      it('returns an instance that exists', done => {
        people.get(_ids.Doug, {}, (error, data) => {
          expect(error).to.be.null;
          expect(data.id).to.equal(_ids.Doug);
          expect(data.name).to.equal('Doug');
          done();
        });
      });

      it('returns an error when no id is provided', done => {
        people.get((error, data) => {
          expect(error).to.be.ok;
          expect(error instanceof errors.BadRequest).to.be.ok;
          expect(data).to.be.undefined;
          done();
        });
      });

      it('returns NotFound error for non-existing id', done => {
        people.get('abc', {}, (error, data) => {
          expect(error).to.be.ok;
          expect(error instanceof errors.NotFound).to.be.ok;
          expect(error.message).to.equal('No record found for id \'abc\'');
          expect(data).to.be.undefined;
          done();
        });
      });
    });

    describe('remove', () => {
      it('deletes an existing instance and returns the deleted instance', done => {
        people.remove(_ids.Doug, {}, function(error, data) {
          expect(error).to.be.null;
          expect(data).to.be.ok;
          expect(data.name).to.equal('Doug');
          done();
        });
      });
    });

    describe.skip('find', () => {
      it('returns all items', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('filters results by a single parameter', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('supports or queries', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('supports and queries', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $sort', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $limit', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $limit', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $skip', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $select', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });

      it('can $populate', done => {
        // expect(service).to.throw('No table name specified.');
        done();
      });
    });

    describe('update', () => {
      it('replaces an existing instance', done => {
        people.update(_ids.Doug, { name: 'Dougler' }, {}, (error, data) => {
          expect(error).to.be.null;
          expect(data.id).to.equal(_ids.Doug);
          expect(data.name).to.equal('Dougler');
          expect(data.age).to.be.null;
          done();
        });
      });

      it('returns NotFound error for non-existing id', done => {
        people.update('abc', { name: 'NotFound' }, {}, (error, data) => {
          expect(error).to.be.ok;
          expect(error instanceof errors.NotFound).to.be.ok;
          expect(error.message).to.equal('No record found for id \'abc\'');
          expect(data).to.be.undefined;
          done();
        });
      });
    });

    describe('patch', () => {
      it('updates an existing instance', done => {
        people.patch(_ids.Doug, { name: 'PatchDoug' }, {}, (error, data) => {
          expect(error).to.be.null;
          expect(data.id).to.equal(_ids.Doug);
          expect(data.name).to.equal('PatchDoug');
          expect(data.age).to.equal(32);
          done();
        });
      });

      it('returns NotFound error for non-existing id', done => {
        people.patch('abc', { name: 'PatchDoug' }, {}, (error, data) => {
          expect(error).to.be.ok;
          expect(error instanceof errors.NotFound).to.be.ok;
          expect(error.message).to.equal('No record found for id \'abc\'');
          expect(data).to.be.undefined;
          done();
        });
      });
    });

    describe('create', () => {
      it('creates a single new instance and returns the created instance', done => {
        people.create({
          name: 'Bill',
          age: 40
        }, {}, (error, data) => {
          expect(error).to.be.null;
          expect(data).to.be.instanceof(Object);
          expect(data).to.not.be.empty;
          expect(data.name).to.equal('Bill');
          done();
        });
      });

      it('creates multiple new instances', done => {
        let items = [
          {
            name: 'Gerald',
            age: 18
          },
          {
            name: 'Herald',
            age: 18
          }
        ];

        people.create(items, {}, (error, data) => {
          expect(error).to.be.null;
          expect(data).to.be.instanceof(Array);
          expect(data).to.not.be.empty;
          expect(data[0].name).to.equal('Gerald');
          expect(data[1].name).to.equal('Herald');
          done();
        });
      });
    });
  });
});
