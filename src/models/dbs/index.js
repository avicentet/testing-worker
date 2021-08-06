const PostgresqlDb = require("./PostgresqlDb");
const MssqlDb = require("./MssqlDb");
const MySqlDb = require("./MySqlDb");

const MAPPING = {
  mysql: MySqlDb,
  postgresql: PostgresqlDb,
  mssql: MssqlDb,
};

const matchDb = (str) => {
  return MAPPING[str];
};

module.exports = {
  matchDb,
};
