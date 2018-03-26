const debug = require('debug')('feathers-knex-transaction');

const start = (options) => {
  return hook => new Promise(resolve => {
    if (!hook.service.Model || typeof hook.service.Model.transaction !== 'function') {
      return resolve(hook);
    }

    if (hook.params.transaction) {
      hook.params.transaction.count += 1;
      return resolve(hook);
    }

    hook.service.Model.transaction(trx => {
      const id = Date.now();
      hook.params.transaction = {
        trx,
        id,
        count: 0
      };
      debug('started a new transaction %s', id);
      return resolve(hook);
    });
  });
};

const end = (options) => {
  return hook => {
    if (hook.params.transaction) {
      const { trx, id, count } = hook.params.transaction;

      if (count > 0) {
        hook.params.transaction.count -= 1;
        return Promise.resolve(hook);
      }

      hook.params.transaction = undefined;

      return trx.commit()
        .then(() => debug('finished transaction %s with success', id))
        .then(() => hook);
    }
    return hook;
  };
};

const rollback = (options) => {
  return hook => {
    if (hook.params.transaction) {
      const { trx, id } = hook.params.transaction;
      return trx.rollback(hook.error)
        .then(() => debug('rolling back transaction %s', id))
        .then(() => hook);
    }
    return hook;
  };
};

module.exports = {
  transaction: {
    start,
    end,
    rollback
  }
};
