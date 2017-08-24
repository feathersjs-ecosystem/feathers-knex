const debug = require('debug')('feathers-knex-transaction');

export const start = (options) => {
  const { dbServiceName } = options;
  debug('started transaction system with %s service', dbServiceName);
  return (hook) =>
    new Promise(resolve =>
      hook.app.get(dbServiceName).transaction(trx => {
        const id = Date.now();
        hook.params.transaction = {
          trx,
          id
        };
        debug('started a new transaction %s', id);
        return resolve(hook);
      })
    );
};

export const end = (options) => {
  return (hook) => {
    if (hook.params.transaction) {
      const { trx, id } = hook.params.transaction;
      return trx.commit()
        .then(() => debug('finished transaction %s with success', id))
        .then(hook);
    }
    return hook;
  };
};

export const rollback = (options) => {
  return (hook) => {
    if (hook.params.transaction) {
      const { trx, id } = hook.params.transaction;
      return trx.rollback()
        .then(() => debug('rolling back transaction %s', id))
        .then(hook);
    }
    return hook;
  };
};
