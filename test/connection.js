const knex = require('knex');

module.exports = DB => {
  if (DB === 'sqlite') {
    return knex({
      client: 'sqlite3',
      connection: {
        filename: './db.sqlite'
      }
    });
  }

  if (DB === 'mysql') {
    return knex({
      client: 'mysql',
      connection: {
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'feathers_knex'
      }
    });
  }

  if (DB === 'postgres') {
    return knex({
      client: 'postgresql',
      connection: {
        host: 'localhost',
        database: 'feathers_knex',
        user: 'postgres',
        password: ''
      }
    });
  }
};
