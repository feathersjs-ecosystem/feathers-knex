const { expect } = require('chai');
const assert = require('assert');
const feathers = require('@feathersjs/feathers');
const knex = require('knex');

const { base } = require('feathers-service-tests');
const errors = require('@feathersjs/errors');

const service = require('../lib');

const { transaction } = service.hooks;

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

// Create a public database to mimic a "schema"
const schemaName = 'public';
knex({
  client: 'sqlite3',
  connection: {
    filename: `./${schemaName}.sqlite`
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

const users = service({
  Model: db,
  schema: schemaName,
  name: 'users',
  events: [ 'testing' ]
});

function clean () {
  return Promise.all([
    db.schema.dropTableIfExists(people.fullName).then(() => {
      return people.init({}, (table) => {
        table.increments('id');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
        return table;
      });
    }),
    db.schema.dropTableIfExists(peopleId.fullName).then(() => {
      return peopleId.init({}, (table) => {
        table.increments('customid');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
        return table;
      });
    }),
    db.schema.dropTableIfExists(users.fullName).then(() => {
      return users.init({}, (table) => {
        table.increments('id');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
        return table;
      });
    })
  ]);
}

function attachSchema () {
  // Attach the public database to mimic a "schema"
  return db.schema.raw(`attach database '${schemaName}.sqlite' as ${schemaName}`);
}

function customQuery () {
  return (context) => {
    const { params, service } = context;
    const query = service.createQuery(params);

    // do something with query here
    query.orderBy('name', 'desc');
    // console.log(query.toSQL().toNative());

    context.params.knex = query;
    return context;
  };
}

describe('Feathers Knex Service', () => {
  const app = feathers()
    .hooks({
      before: transaction.start(),
      after: transaction.end(),
      error: transaction.rollback()
    })
    .use('/people', people)
    .use('people-customid', peopleId)
    .use('/users', users);

  before(attachSchema);
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

    describe('database schema support', () => {
      base(app, errors, 'users');
    });
  });

  describe('custom queries', () => {
    before(clean);
    before(() => {
      app.hooks({});
      app.service('people').hooks({
        before: {
          find: customQuery()
        }
      });
      app.service('users').hooks({
        before: {
          find: customQuery()
        }
      });
    });
    after(clean);
    after(() => {
      app.hooks({
        before: transaction.start(),
        after: transaction.end(),
        error: transaction.rollback()
      });
      app.service('people').hooks({});
      app.service('users').hooks({});
    });

    base(app, errors, 'people');

    describe('database schema support', () => {
      base(app, errors, 'users');
    });
  });

  describe('$like method', () => {
    beforeEach(() => app.service('/people').create({
      name: 'Charlie Brown',
      age: 10
    }));

    it('$like in query', () => {
      return app.service('/people').find({
        query: { name: { $like: '%lie%' } }
      }).then(data => {
        expect(data[0].name).to.be.equal('Charlie Brown');
      });
    });
  });

  describe('adapter specifics', () => {
    it('$or works properly (#120)', () => {
      app.service('/people').create([{
        name: 'Dave',
        age: 23
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          name: 'Dave',
          $or: [{
            age: 1
          }, {
            age: 32
          }]
        }
      }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.be.equal('Dave');
        expect(data[0].age).to.be.equal(32);
        app.service('/people').remove(null);
      });
    });

    it('$and works properly', () => {
      app.service('/people').create([{
        name: 'Dave',
        age: 23
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          $and: [{
            $or: [
              {name: 'Dave'},
              {name: 'Dada'}
            ]
          }, {
            age: {$lt: 23}
          }]
        }
      }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.be.equal('Dada');
        expect(data[0].age).to.be.equal(1);
        app.service('/people').remove(null);
      });
    });

    it('where conditions support NULL values properly', () => {
      app.service('/people').create([{
        name: 'Dave without age',
        age: null
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          age: null
        }
      }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.be.equal('Dave without age');
        expect(data[0].age).to.be.equal(null);
        app.service('/people').remove(null);
      });
    });

    it('where conditions support NOT NULL case properly', () => {
      app.service('/people').create([{
        name: 'Dave without age',
        age: null
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          age: {$ne: null}
        }
      }).then(data => {
        expect(data.length).to.equal(2);
        expect(data[0].name).to.not.be.equal('Dave without age');
        expect(data[0].age).to.not.be.equal(null);
        expect(data[1].name).to.not.be.equal('Dave without age');
        expect(data[1].age).to.not.be.equal(null);
        app.service('/people').remove(null);
      });
    });

    it('where conditions support NULL values within AND conditions', () => {
      app.service('/people').create([{
        name: 'Dave',
        age: null
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          age: null,
          name: 'Dave'
        }
      }).then(data => {
        expect(data.length).to.equal(1);
        expect(data[0].name).to.be.equal('Dave');
        expect(data[0].age).to.be.equal(null);
        app.service('/people').remove(null);
      });
    });

    it('where conditions support NULL values within OR conditions', () => {
      app.service('/people').create([{
        name: 'Dave without age',
        age: null
      }, {
        name: 'Dave',
        age: 32
      }, {
        name: 'Dada',
        age: 1
      }]);

      return app.service('/people').find({
        query: {
          $or: [
            {
              age: null
            },
            {
              name: 'Dada'
            }
          ]
        }
      }).then(data => {
        expect(data.length).to.equal(2);
        expect(data[0].name).not.be.equal('Dave');
        expect(data[0].age).not.be.equal(32);
        expect(data[1].name).not.be.equal('Dave');
        expect(data[1].age).not.be.equal(32);
        app.service('/people').remove(null);
      });
    });
  });
});
