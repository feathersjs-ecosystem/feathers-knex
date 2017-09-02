# feathers-knex

[![Greenkeeper badge](https://badges.greenkeeper.io/feathersjs/feathers-knex.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/feathersjs/feathers-knex.png?branch=master)](https://travis-ci.org/feathersjs/feathers-knex)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-knex.png)](https://codeclimate.com/github/feathersjs/feathers-knex)
[![Test Coverage](https://codeclimate.com/github/feathersjs/feathers-knex/badges/coverage.svg)](https://codeclimate.com/github/feathersjs/feathers-knex/coverage)
[![Dependency Status](https://img.shields.io/david/feathersjs/feathers-knex.svg?style=flat-square)](https://david-dm.org/feathersjs/feathers-knex)
[![Download Status](https://img.shields.io/npm/dm/feathers-knex.svg?style=flat-square)](https://www.npmjs.com/package/feathers-knex)
[![Slack Status](http://slack.feathersjs.com/badge.svg)](http://slack.feathersjs.com)

> A [Knex.js](http://knexjs.org/) service adapter for [FeathersJS](http://feathersjs.com)


## Installation

```bash
npm install feathers-knex --save
```

## Documentation

Please refer to the [Feathers database adapter documentation](https://docs.feathersjs.com/api/databases/common.html) for more details or directly at:

- [KnexJS](http://docs.feathersjs.com/api/databases/knexjs.html) - The detailed documentation for this adapter
- [Extending](https://docs.feathersjs.com/api/databases/common.html#extending-adapters) - How to extend a database adapter
- [Pagination](https://docs.feathersjs.com/api/databases/common.html#pagination) - How to use pagination
- [Querying and Sorting](https://docs.feathersjs.com/api/databases/querying.html) - The common adapter querying mechanism and sorting for the database adapter


## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service. We are using the [Knex schema builder](http://knexjs.org/#Schema)

```js
import feathers from 'feathers';
import rest from 'feathers-rest';
import bodyParser from 'body-parser';
import knexService from 'feathers-knex';

// Initialize knex database adapter
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

// Create Knex Feathers service with a default page size of 2 items
// and a maximum size of 4
var todos = knexService({
  Model: knex,
  name: 'todos',
  paginate: {
    default: 2,
    max: 4
  }
});

// Create a feathers instance.
const app = feathers()
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }));

// Initialize the database table with a schema
// then mount the service and start the app
todos
  .init({}, function(table) {

    //define your schema
    console.log(`created ${table._tableName} table`);
    table.increments('id');
    table.string('text');
    table.boolean('complete');

  }).then(() => {

    app.use('/todos', todos);

    app.use(function(error, req, res, next){
      res.json(error);
    });

    // Start the server.
    const port = 8080;
    app.listen(port, function() {
      console.log(`Feathers server listening on port ${port}`);
    });

  });
```

You can run this example by using `node server` and going to [localhost:8080/todos](http://localhost:8080/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

# Transaction Support
A example of using the transaction hooks:
```javascript
// A common hooks file
import { hooks } from 'feathers-knex';

const { transaction } = hooks;

const logger = require('./hooks/logger');

module.exports = {
  before: {
    all: [transaction.start({ dbServiceName: 'knexClient' })],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [logger(), transaction.end()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [transaction.rollback(), logger()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
```

To use the transactions feature, you must ensure that the three hooks (start, commit and rollback) are being used.

At the start of any request, a new transaction will be started. All the changes made during the request to the services that are using the `feathers-knex` will use the transaction. At the end of the request, if sucessful, the changes will be commited. If an error occurs, the changes will be forfeit, all the `creates`, `patches`, `updates` and `deletes` are not going to be commited.

The object that contains `transaction` is stored in the `params.transaction` of each request. If you must extend the `feathers-knex` service, use the `params.transaction.trx` to make your database calls, or simply call the method `this.db(params)` inside a class that extends de `feathers-knex` service.


## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
