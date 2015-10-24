import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import knex from 'knex';
import { types as errors } from 'feathers-errors';

// Create the service.
export const Service = Proto.extend({
	init(name, options) {
    if(typeof name !== 'string') {
      throw new Error('Database name must be provided');
    }

    if(!options) {
      throw new Error('KnexJS options have to be provided');
    }

    this.id = options.id || 'id';
    this.knex = typeof options === 'function' ? options : knex(options);
    this.name = name;
	},

  db() {
    return this.knex(this.name);
  },

	find(params, callback) {
    let fields = ['*'];
    let query = this.db().select(... fields);

		// Prepare the special query params.
		if (params.query) {
			let filters = filter(params.query);

			// $select uses a specific find syntax, so it has to come first.
			if (filters.$select) {
				fields = Object.keys(filters.$select).map(field => !!filters.$select[field]);
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
			return callback(new errors.BadRequest('An id is required for GET operations'));
		}

    params.query = params.query || {};
    params.query[this.id] = id;

    this.find(params, (error, data) => {
      if(error) {
        return callback(error);
      }

      if(data && data.length !== 1) {
        return callback(new errors.NotFound('No matching single record found'));
      }

      callback(null, data[0]);
    });
	},

	create(data, params, callback) {
    this.db().insert(data).then(rows => this.get(rows[0], params, callback), callback);
	},

	patch(id, data, params, callback) {
    // TODO
		throw new Error('Not implemented', id, data, params, callback);
	},

	update(id, data, params, callback) {
		delete data[this.id]; // Delete id field
		// TODO
		throw new Error('Not implemented', id, data, params, callback);
	},

	remove(id, params, callback) {
		// TODO
		throw new Error('Not implemented', id, params, callback);
	}
});

export default function() {
  return Proto.create.apply(Service, arguments);
}
