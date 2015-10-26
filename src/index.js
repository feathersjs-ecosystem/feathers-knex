import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import knex from 'knex';
import { types as errors } from 'feathers-errors';

// Create the service.
export const Service = Proto.extend({
	init(name, options) {
    if(typeof name !== 'string') {
      throw new Error('No table name specified.');
    }

    if(!options) {
      throw new Error('KnexJS options have to be provided');
    }

    this.id = options.id || 'id';
    this.knex = typeof options === 'function' ? options : knex(options);
    this.name = name;
	},

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db() {
    return this.knex(this.name);
  },

	find(params, callback) {
    let fields = ['*'];
    let query = this.db().select(fields);

		// Prepare the special query params.
		if (params.query) {
			let filters = filter(params.query);

			// $select uses a specific find syntax, so it has to come first.
			if (filters.$select) {
        fields = filters.$select;
			}

      query = this.db().select(... fields).where(params.query);

			// Handle $sort
			if (filters.$sort) {
        Object.keys(filters.$sort).forEach(key =>
          query = query.orderBy(key, parseInt(filters.$sort[key], 10) === 1 ? 'asc' : 'desc'));
			}

			// Handle $limit
			if (filters.$limit) {
        query.limit(parseInt(filters.$limit, 10));
			}

			// Handle $skip
			if (filters.$skip) {
        query.offset(parseInt(filters.$skip, 10));
			}
		}

    query.then(data => callback(null, data), callback);
	},

	get(id, params, callback) {
		if (typeof id === 'function') {
      callback = id;
			return callback(new errors.BadRequest('An id is required for GET operations'));
		}

    params.query = params.query || {};
    params.query[this.id] = id;

    this.find(params, (error, data) => {
      if(error) {
        return callback(error);
      }

      if(data && data.length !== 1) {
        return callback(new errors.NotFound(`No record found for id '${id}'`));
      }

      callback(null, data[0]);
    });
	},

	create(data, params, callback) {
    this.db().insert(data).then(rows => {
      // if we inserted a single record call get otherwise call find
      if (rows.length === 1) {
        return this.get(rows[0], params, callback); 
      }
      
      // TODO (EK): We'll need to use a .orWhere query for each id that we pass
      // So we need to figure out what the syntax should be for find to handle
      // OR queries. Possibly $or as a special param.
      this.find(rows[0], params, callback);
    }, callback);
	},

	patch(id, data, params, callback) {
    // NOTE (EK): First fetch the old record so that we
    // can merge our new properties on top of it.
    this.get(id, params, (error, oldData) => {
      if (error) {
        return callback(error);
      }

      let newObject = Object.assign(oldData, data);

      // NOTE (EK): Delete id field so we don't update it
      delete newObject[this.id];

      this.db().where(this.id, id).update(newObject).asCallback((error) => {
        if (error) {
          return callback(error);
        }

        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id;

        callback(null, newObject);
      });
    });
	},

	update(id, data, params, callback) {
    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    this.get(id, params, (error, oldData) => {
      if (error) {
        return callback(error);
      }

      let newObject = {};

      for (var key of Object.keys(oldData)) {
        if (data[key] === undefined) {
          newObject[key] = null;
        }
        else {
          newObject[key] = data[key];
        }
      }

      // NOTE (EK): Delete id field so we don't update it
      delete newObject[this.id];

      this.db().where(this.id, id).update(newObject).asCallback((error) => {
        if (error) {
          return callback(error);
        }

        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id;
        callback(null, newObject);
      });
    });
	},

	remove(id, params, callback) {
    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    this.get(id, params, (error, data) => {
      if (error) {
        return callback(error);
      }

      this.db().where(this.id, id).del().asCallback((error) => {
        if (error) {
          return callback(error);
        }

        callback(null, data);
      });
    });
	}
});

export default function() {
  return Proto.create.apply(Service, arguments);
}
