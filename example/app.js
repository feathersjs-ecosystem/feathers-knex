var feathers = require('feathers');
var bodyParser = require('body-parser');
var knex = require('../lib');
var path = require('path');

var options = {
  name: 'todos',
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  },
  paginate: {
    default: 2,
    max: 4
  }
};

var todos = knex(options);

todos.knex.schema.dropTableIfExists('todos').then(function() {
  console.log('Dropped todos table');

  return todos.knex.schema.createTable('todos', function(table) {
    console.log('Creating todos table');
    table.increments('id');
    table.string('text');
    table.boolean('complete');
  });
});

// Create a feathers instance.
var app = feathers()
  // Enable Socket.io
  .configure(feathers.socketio())
  // Enable REST services
  .configure(feathers.rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({ extended: true }));

// Create an in-memory Feathers service with a default page size of 2 items
// and a maximum size of 4
app.use('/todos', todos);

app.use(function(error, req, res, next){
  res.json(error);
});

// Start the server
module.exports = app.listen(3030);

console.log('Feathers Todo Knex service running on 127.0.0.1:3030');
