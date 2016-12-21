# feathers-knex

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

Please refer to the [Feathers database adapter documentation](http://docs.feathersjs.com/databases/readme.html) for more details or directly at:

- [KnexJS](http://docs.feathersjs.com/databases/knexjs.html) - The detailed documentation for this adapter
- [Extending](http://docs.feathersjs.com/databases/extending.html) - How to extend a database adapter
- [Pagination and Sorting](http://docs.feathersjs.com/databases/pagination.html) - How to use pagination and sorting for the database adapter
- [Querying](http://docs.feathersjs.com/databases/querying.html) - The common adapter querying mechanism

## Complete Example

Here's a complete example of a Feathers server with a `todos` SQLite service. We are using the [Knex schema builder](http://knexjs.org/#Schema)

```js
import feathers from 'feathers';
import rest from 'feathers-rest';
import bodyParser from 'body-parser';
import knexService from 'feathers-knex';

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
});

// Clean up our data. This is optional and is here
// because of our integration tests
knex.schema.dropTableIfExists('todos').then(function() {
  console.log('Dropped todos table');

  // Initialize your table
  return knex.schema.createTable('todos', function(table) {
    console.log('Creating todos table');
    table.increments('id');
    table.string('text');
    table.boolean('complete');
  });
});

// Create a feathers instance.
const app = feathers()
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }));

// Create Knex Feathers service with a default page size of 2 items
// and a maximum size of 4
app.use('/todos', knexService({
  Model: knex,
  name: 'todos',
  paginate: {
    default: 2,
    max: 4
  }
}));

app.use(function(error, req, res, next){
  res.json(error);
});

// Start the server.
const port = 8080;
app.listen(port, function() {
  console.log(`Feathers server listening on port ${port}`);
});
```

You can run this example by using `node server` and going to [localhost:8080/todos](http://localhost:8080/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
