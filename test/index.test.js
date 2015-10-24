import assert from 'assert';
import createService from '../src';

describe('feathers-knex service', () => {
  let service = null;

  beforeEach(done => {
    service = createService('todos', {
      dialect: 'sqlite3',
      connection: {
        filename: './data.db'
      }
    });

    service.knex.schema.dropTableIfExists('todos').then(() => {
      service.knex.schema.createTable('todos', function(table) {
        table.increments('id');
        table.string('text');
        table.boolean('complete');
      }).then(() => {
        service.create({
          text: 'todo 1',
          complete: true
        }, {}, function() {
          service.create({
            text: 'todo 2',
            complete: false
          }, {}, done);
        });
      });
    });
  });

  it('.create', done => {
    service.create({
      text: '.create todo',
      complete: true
    }, {}, (error, todo) => {
      assert.equal(todo.text, '.create todo');
      assert.ok(todo.complete);
      done();
    });
  });
});
