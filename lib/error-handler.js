const errors = require('@feathersjs/errors');

module.exports = function errorHandler (error) {
  let feathersError = error;

  // TODO (EK): Map PG, Oracle, etc. errors

  // NOTE: SQLState values from
  // https://dev.mysql.com/doc/connector-j/5.1/en/connector-j-reference-error-sqlstates.html

  if (error.sqlState && error.sqlState.length) {
    // remove SQLSTATE marker (#) and pad/truncate SQLSTATE to 5 chars
    let sqlState = ('00000' + error.sqlState.replace('#', '')).slice(-5);

    switch (sqlState.slice(0, 2)) {
      case '02':
        feathersError = new errors.NotFound(error);
        break;
      case '28':
        feathersError = new errors.Forbidden(error);
        break;
      case '08':
      case '0A':
      case '0K':
        feathersError = new errors.Unavailable(error);
        break;
      case '20':
      case '21':
      case '22':
      case '23':
      case '24':
      case '25':
      case '40':
      case '42':
      case '70':
        feathersError = new errors.BadRequest(error);
        break;
      default:
        feathersError = new errors.GeneralError(error);
    }
  }

  // NOTE (EK): Error codes taken from
  // https://www.sqlite.org/c3ref/c_abort.html

  if (error.code === 'SQLITE_ERROR') {
    switch (error.errno) {
      case 1:
      case 8:
      case 18:
      case 19:
      case 20:
        feathersError = new errors.BadRequest(error);
        break;
      case 2:
        feathersError = new errors.Unavailable(error);
        break;
      case 3:
      case 23:
        feathersError = new errors.Forbidden(error);
        break;
      case 12:
        feathersError = new errors.NotFound(error);
        break;
      default:
        feathersError = new errors.GeneralError(error);
        break;
    }
  }

  // NOTE: Error codes taken from
  // https://www.postgresql.org/docs/9.6/static/errcodes-appendix.html
  if (typeof error.code === 'string' && error.severity && error.routine) {
    // Omit query information
    const messages = error.message.split('-');
    error.message = messages[messages.length - 1];

    switch (error.code.slice(0, 2)) {
      case '22':
      case '23':
        feathersError = new errors.BadRequest(error);
        break;
      case '28':
        feathersError = new errors.Forbidden(error);
        break;
      case '3D':
      case '3F':
      case '42':
        feathersError = new errors.Unprocessable(error);
        break;
      default:
        feathersError = new errors.GeneralError(error);
        break;
    }
  }

  throw feathersError;
};
