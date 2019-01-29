module.exports = DB => {
  if (DB === 'sqlite') {
    return {
      client: 'sqlite3',
      connection: {
        filename: './db.sqlite'
      }
    };
  }

  if (DB === 'mysql') {
    return {
      client: 'mysql',
      connection: {
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'feathers_knex'
      }
    };
  }

  if (DB === 'postgres') {
    return {
      client: 'postgresql',
      connection: {
        host: 'localhost',
        database: 'feathers_knex',
        user: 'postgres',
        password: ''
      }
    };
  }
};
