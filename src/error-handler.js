import errors from 'feathers-errors';

export default function errorHandler(error) {
  let feathersError = error;

  //TODO (EK): Map PG, MySQL, Oracle, etc. errors

  // NOTE (EK): Error codes taken from
  // https://www.sqlite.org/c3ref/c_abort.html

  if (error.code === 'SQLITE_ERROR') {
    switch(error.errno) {
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
  
  throw feathersError;
}