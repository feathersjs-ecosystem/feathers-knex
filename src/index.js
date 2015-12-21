if(!global._babelPolyfill) { require('babel-polyfill'); }

import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import isPlainObject from 'is-plain-object';
import knex from 'knex';
import { errors } from 'feathers-errors';

const METHODS = {
  $or: 'orWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn'
};

const OPERATORS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>='
};

// Create the service.
class Service {
	constructor(options) {
    if(!options) {
      throw new Error('KnexJS options have to be provided');
    }

    if(typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    this.name = options.name;
    this.id = options.id || 'id';
    this.paginate = options.paginate || {};
    this.knex = typeof options === 'function' ? options : knex(options);
	}

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db() {
    return this.knex(this.name);
  }

  extend(obj) {
		return Proto.extend(obj, this);
	}

  knexify(query, params, parentKey) {
    Object.keys(params).forEach((key) => {
      const value = params[key];

      if (isPlainObject(value)) {
        return this.knexify(query, value, key);
      }

      const column = parentKey || key;
      const method = METHODS[key];
      const operator = OPERATORS[key] || '=';

      // TODO (EK): Handle $or queries with nested specials.
      // Right now they won't work and we'd need to start diving
      // into nested where conditions.
      if (method) {
        if (key === '$or') {
          return value.forEach(condition => query[method].call(query, condition));
        }

        return query[method].call(query, column, value);
      }

      return query.where(column, operator, value);
    });
  }

	find(params) {
    params.query = params.query || {};

    let query = this.db().select(['*']);
    let filters = filter(params.query);

    if(this.paginate.default) {
      filters.$limit = Math.min(filters.$limit || this.paginate.default,
				this.paginate.max || Number.MAX_VALUE);
    }

		// $select uses a specific find syntax, so it has to come first.
		if (filters.$select) {
      let fields = filters.$select;
      query = this.db().select(... fields);
		}

    // build up the knex query out of the query params
    this.knexify(query, params.query);

		// Handle $sort
		if (filters.$sort) {
      Object.keys(filters.$sort).forEach(key =>
        query = query.orderBy(key, parseInt(filters.$sort[key], 10) === 1 ? 'asc' : 'desc'));
		}

		// Handle $limit
		if (filters.$limit) {
      query.limit(filters.$limit);
		}

		// Handle $skip
		if (filters.$skip) {
      query.offset(filters.$skip);
		}

    if (this.paginate.default && !params.query[this.id]) {
      let countQuery = this.db().count('id as total');

      this.knexify(countQuery, params.query);

      return countQuery.then(function(count) {
        return query.then(data => {
          return {
  					total: count[0].total,
  					limit: filters.$limit,
  					skip: filters.$skip || 0,
  					data
  				};
        });
      });
		}

    return query;
	}

	get(id, params) {
    params.query = params.query || {};
    params.query[this.id] = id;

    return this.find(params).then(data => {
      if(data && data.length !== 1) {
        throw new errors.NotFound(`No record found for id '${id}'`);
      }

      return data[0];
    });
	}

	create(data, params) {
    if(Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return this.db().insert(data).then(rows => this.get(rows[0], params));
	}

	patch(id, data, params) {
    params.query = params.query || {};
    data = Object.assign({}, data);

    if(id !== null) {
      params.query[this.id] = id;
    }

    let query = this.db();
    this.knexify(query, params.query);

    delete data[this.id];

    return query.update(data).then(() => {
      return this.find(params).then(items => {
        if(items.length ===  0) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        if(items.length === 1) {
          return items[0];
        }

        return items;
      });
    });
	}

	update(id, data, params) {
    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this.get(id, params).then(oldData => {
      let newObject = {};

      for (var key of Object.keys(oldData)) {
        if (data[key] === undefined) {
          newObject[key] = null;
        } else {
          newObject[key] = data[key];
        }
      }

      // NOTE (EK): Delete id field so we don't update it
      delete newObject[this.id];

      return this.db().where(this.id, id).update(newObject).then(() => {
        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id;
        return newObject;
      });
    });
	}

	remove(id, params) {
    params.query = params.query || {};

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if(id !== null) {
      params.query[this.id] = id;
    }

    return this.find(params).then(items => {
      let query = this.db();
      this.knexify(query, params.query);

      return query.del().then(() => {
        if(items.length === 1) {
          return items[0];
        }

        return items;
      });
    });
	}
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
