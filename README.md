# feathers-knex

[![Build Status](https://travis-ci.org/feathersjs/feathers-knex.png?branch=master)](https://travis-ci.org/feathersjs/feathers-knex)

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
import knexService from '../lib';

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

console.log('Feathers Todo Knex service running on 127.0.0.1:3030');
```

You can run this example by using `node server` and going to [localhost:8080/todos](http://localhost:8080/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

## Changelog

__2.1.0__

- Use internal methods instead of service methods directly

__2.0.0__

- Refactoring to be independent from Knex module
- Compatibility with latest common Feathers service specification

__1.2.0__

- Babel 6 support, Object.assign polyfill and CommonJS module backwards compatibility

__1.1.0__

- Compatibility with latest service tests

__1.0.0__

- Initial release

## License

Copyright (c) 2015

Licensed under the [MIT license](LICENSE).
