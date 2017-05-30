import feathers from 'feathers';
import rest from 'feathers-rest';
import bodyParser from 'body-parser';
import knexService from '../lib';

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
