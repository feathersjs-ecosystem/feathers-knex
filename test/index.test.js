const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const feathers = require('@feathersjs/feathers');
const knex = require('knex');

const adapterTests = require('@feathersjs/adapter-tests');
const errors = require('@feathersjs/errors');

const service = require('../lib');
const testSuite = adapterTests([
  '.options',
  '.events',
  '._get',
  '._find',
  '._create',
  '._update',
  '._patch',
  '._remove',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multi query',
  '.patch + NotFound',
  '.create',
  '.create + $select',
  '.create multi',
  'internal .find',
  'internal .get',
  'internal .create',
  'internal .update',
  'internal .patch',
  'internal .remove',
  '.find + equal',
  '.find + equal multiple',
  '.find + $sort',
  '.find + $sort + string',
  '.find + $limit',
  '.find + $limit 0',
  '.find + $skip',
  '.find + $select',
  '.find + $or',
  '.find + $in',
  '.find + $nin',
  '.find + $lt',
  '.find + $lte',
  '.find + $gt',
  '.find + $gte',
  '.find + $ne',
  '.find + $gt + $lt + $sort',
  '.find + $or nested + $sort',
  '.find + paginate',
  '.find + paginate + $limit + $skip',
  '.find + paginate + $limit 0',
  '.find + paginate + params',
  '.get + id + query id',
  '.remove + id + query id',
  '.update + id + query id',
  '.patch + id + query id'
]);

chai.use(chaiAsPromised);
const { expect } = chai;

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
  events: ['testing']
});

const peopleId = service({
  Model: db,
  id: 'customid',
  name: 'people-customid',
  events: ['testing']
});

const users = service({
  Model: db,
  schema: schemaName,
  name: 'users',
  events: ['testing']
});

function clean () {
  return Promise.all([
    db.schema.dropTableIfExists(people.fullName).then(() => {
      return db.schema.createTable(people.fullName, (table) => {
        table.increments('id');
        table.string('name').notNullable();
        table.integer('age');
        table.integer('time');
        table.boolean('created');
        return table;
      });
    }),
    db.schema.dropTableIfExists(peopleId.fullName).then(() => {
      return db.schema.createTable(peopleId.fullName, (table) => {
        table.increments('customid');
        table.string('name');
        table.integer('age');
        table.integer('time');
        table.boolean('created');
        return table;
      });
    }),
    db.schema.dropTableIfExists(users.fullName).then(() => {
      return db.schema.createTable(users.fullName, (table) => {
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
  const peopleService = app.service('people');

  before(attachSchema);
  before(clean);
  after(clean);

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () =>
        expect(service.bind(null))
          .to.throw('You must provide a Model (the initialized knex object)')
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

  describe('$like method', () => {
    let charlie;

    beforeEach(async () => {
      charlie = await peopleService.create({
        name: 'Charlie Brown',
        age: 10
      });
    });

    afterEach(() => peopleService.remove(charlie.id));

    it('$like in query', async () => {
      const data = await peopleService.find({
        query: { name: { $like: '%lie%' } }
      });

      expect(data[0].name).to.be.equal('Charlie Brown');
    });
  });

  describe('$notlike method', () => {
    let hasMatch;
    let hasNoMatch;

    beforeEach(async () => {
      hasMatch = await peopleService.create({
        name: 'XYZabcZYX'
      });
      hasNoMatch = await peopleService.create({
        name: 'XYZZYX'
      });
    });

    afterEach(() => {
      peopleService.remove(hasMatch.id);
      peopleService.remove(hasNoMatch.id);
    });

    it('$notlike in query', async () => {
      const data = await peopleService.find({
        query: { name: { $notlike: '%abc%' } }
      });

      expect(data.length).to.be.equal(1);
      expect(data[0].name).to.be.equal('XYZZYX');
    });
  });

  describe('adapter specifics', () => {
    let daves;

    beforeEach(async () => {
      daves = await Promise.all([
        peopleService.create({
          name: 'Ageless',
          age: null
        }),
        peopleService.create({
          name: 'Dave',
          age: 32
        }),
        peopleService.create({
          name: 'Dada',
          age: 1
        })
      ]);
    });

    afterEach(async () => Promise.all([
      peopleService.remove(daves[0].id),
      peopleService.remove(daves[1].id),
      peopleService.remove(daves[2].id)
    ]).catch(() => {}));

    it('$or works properly (#120)', async () => {
      const data = await peopleService.find({
        query: {
          name: 'Dave',
          $or: [{
            age: 1
          }, {
            age: 32
          }]
        }
      });

      expect(data.length).to.equal(1);
      expect(data[0].name).to.be.equal('Dave');
      expect(data[0].age).to.be.equal(32);
    });

    it('$and works properly', async () => {
      const data = await peopleService.find({
        query: {
          $and: [{
            $or: [
              { name: 'Dave' },
              { name: 'Dada' }
            ]
          }, {
            age: { $lt: 23 }
          }]
        }
      });

      expect(data.length).to.equal(1);
      expect(data[0].name).to.be.equal('Dada');
      expect(data[0].age).to.be.equal(1);
    });

    it('where conditions support NULL values properly', async () => {
      const data = await peopleService.find({
        query: {
          age: null
        }
      });

      expect(data.length).to.equal(1);
      expect(data[0].name).to.be.equal('Ageless');
      expect(data[0].age).to.be.equal(null);
    });

    it('where conditions support NOT NULL case properly', async () => {
      const data = await peopleService.find({
        query: {
          age: { $ne: null }
        }
      });

      expect(data.length).to.equal(2);
      expect(data[0].name).to.not.be.equal('Ageless');
      expect(data[0].age).to.not.be.equal(null);
      expect(data[1].name).to.not.be.equal('Ageless');
      expect(data[1].age).to.not.be.equal(null);
    });

    it('where conditions support NULL values within AND conditions', async () => {
      const data = await peopleService.find({
        query: {
          age: null,
          name: 'Ageless'
        }
      });

      expect(data.length).to.equal(1);
      expect(data[0].name).to.be.equal('Ageless');
      expect(data[0].age).to.be.equal(null);
    });

    it('where conditions support NULL values within OR conditions', async () => {
      const data = await peopleService.find({
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
      });

      expect(data.length).to.equal(2);
      expect(data[0].name).not.be.equal('Dave');
      expect(data[0].age).not.be.equal(32);
      expect(data[1].name).not.be.equal('Dave');
      expect(data[1].age).not.be.equal(32);
    });

    it('attaches the SQL error', async () => {
      expect(service.ERROR).to.not.equal(undefined);

      try {
        await peopleService.create({});
        expect(false);
      } catch (error) {
        expect(error.name).to.equal('GeneralError');
        expect(error[service.ERROR]);
      }
    });

    it('.patch works with paginate (#184)', async () => {
      const dave = await peopleService.patch(daves[1].id, { age: 33 }, {
        paginate: {
          default: 10
        }
      });

      expect(dave.age).to.equal(33);
    });
  });

  describe('hooks', () => {
    afterEach(async () => {
      await db('people').truncate();
    });

    it('does reject on problem with commit', async () => {
      const app = feathers();

      app.hooks({
        before: transaction.start(),
        after: [
          (context) => {
            const client = context.params.transaction.trx.client;
            const query = client.query;

            client.query = (conn, sql) => {
              let result = query.call(client, conn, sql);

              if (sql === 'COMMIT;') {
                result = result.then(() => {
                  throw new TypeError('Deliberate');
                });
              }

              return result;
            };
          },
          transaction.end()
        ],
        error: transaction.rollback()
      });

      app.use('/people', people);

      await expect(app.service('/people').create({ name: 'Foo' }))
        .to.eventually.be.rejectedWith(TypeError, 'Deliberate');
    });

    it('does commit, rollback, nesting', async () => {
      const app = feathers();

      app.hooks({
        before: transaction.start({ getKnex: () => db }),
        after: transaction.end(),
        error: transaction.rollback()
      });

      app.use('/people', people);

      app.use('/test', {
        create: async (data, params) => {
          await app.service('/people').create({ name: 'Foo' }, { ...params });

          if (data.throw) {
            throw new TypeError('Deliberate');
          }
        }
      });

      await expect(app.service('/test').create({ throw: true }))
        .to.eventually.be.rejectedWith(TypeError, 'Deliberate');

      expect(await app.service('/people').find()).to.have.length(0);

      await expect(app.service('/test').create({}))
        .to.eventually.be.fulfilled;

      expect(await app.service('/people').find()).to.have.length(1);
    });

    it('does use savepoints for nested calls', async () => {
      const app = feathers();

      app.hooks({
        before: transaction.start({ getKnex: () => db }),
        after: transaction.end(),
        error: transaction.rollback()
      });

      app.use('/people', people);

      app.use('/success', {
        create: async (data, params) => {
          await app.service('/people').create({ name: 'Success' }, { ...params });
        }
      });

      app.use('/fail', {
        create: async (data, params) => {
          await app.service('/people').create({ name: 'Fail' }, { ...params });
          throw new TypeError('Deliberate');
        }
      });

      app.use('/test', {
        create: async (data, params) => {
          await app.service('/success').create({}, { ...params });
          await app.service('/fail').create({}, { ...params }).catch(() => {});
        }
      });

      await app.service('/test').create({});

      const created = await app.service('/people').find();

      expect(created).to.have.length(1);
      expect(created[0]).to.have.property('name', 'Success');
    });
  });

  testSuite(app, errors, 'users');
  testSuite(app, errors, 'people');
  testSuite(app, errors, 'people-customid', 'customid');
});
