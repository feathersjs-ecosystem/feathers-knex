if(!global._babelPolyfill) { require('babel-polyfill'); }

import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import isPlainObject from 'is-plain-object';
import errorHandler from './error-handler';
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
    if (!options) {
      throw new Error('Knex options have to be provided');
    }

    if (!options.Model) {
      throw new Error('You must provide a Model (the initialized knex object)');
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    this.knex = options.Model;
    this.id = options.id || 'id';
    this.paginate = options.paginate || {};
    this.table = options.name;
	}

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db() {
    return this.knex(this.table);
  }

  extend(obj) {
		return Proto.extend(obj, this);
	}

  knexify(query, params, parentKey) {
    Object.keys(params || {}).forEach((key) => {
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

	_find(params, count, getFilter = filter) {
    let query = this.db().select(['*']);
    let filters = getFilter(params.query || {});

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
    
    const executeQuery = total => {
      return query.then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };
    
    if(count) {
      let countQuery = this.db().count('id as total');

      this.knexify(countQuery, params.query);

      return countQuery.then(count => count[0].total).then(executeQuery);
    }

    return executeQuery();
	}
  
  find(params) {
    const paginate = !!this.paginate.default;
    const result = this._find(params, paginate, query => filter(query, this.paginate));

    if(!paginate) {
      return result.then(page => page.data);
    }

    return result;
  }

	_get(id, params) {
    params.query = params.query || {};
    params.query[this.id] = id;

    return this._find(params)
      .then(page => {
        if(page.data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return page.data[0];
      }).catch(errorHandler);
	}
  
  get(...args) {
    return this._get(...args);
  }
  
  _create(data, params) {
    return this.db().insert(data, this.id).then(rows => this.get(rows[0], params))
      .catch(errorHandler);
  }

	create(data, params) {
    if(Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current, params)));
    }

    return this._create(data, params);
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
      return this._find(params).then(page => {
        const items = page.data;
        
        if(id !== null) {
          if(items.length === 1) {
            return items[0];
          } else {
            throw new errors.NotFound(`No record found for id '${id}'`);
          }
        }

        return items;
      });
    }).catch(errorHandler);
	}

	update(id, data, params) {
    if(Array.isArray(data)) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?');
    }

    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params).then(oldData => {
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
    }).catch(errorHandler);
	}

	remove(id, params) {
    params.query = params.query || {};

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if(id !== null) {
      params.query[this.id] = id;
    }

    return this._find(params).then(page => {
      const items = page.data;
      const query = this.db();
      
      this.knexify(query, params.query);

      return query.del().then(() => {
        if(id !== null) {
          if(items.length === 1) {
            return items[0];
          } else {
            throw new errors.NotFound(`No record found for id '${id}'`);
          }
        }

        return items;
      });
    }).catch(errorHandler);
	}
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
