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

// Start the server
module.exports = app.listen(3030);

console.log('Feathers Todo Knex service running on 127.0.0.1:3030');
