import { default as knexService, hooks } from 'feathers-knex';
import feathers from '@feathersjs/feathers';
import { knex } from 'knex';

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

const service = knexService({
  Model: db,
  name: 'test'
});

const app = feathers().use('/test', service);

app.service('test').hooks({
  before: {
    all: [
      hooks.transaction.start(),
      hooks.transaction.end(),
      hooks.transaction.rollback()
    ]
  }
});
