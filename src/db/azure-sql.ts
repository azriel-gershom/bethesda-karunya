import sql from 'mssql';
import * as dotenv from 'dotenv';
dotenv.config();

const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  server: process.env.AZURE_SQL_SERVER || '',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.AZURE_SQL_ENCRYPT === 'true', // true for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};

let poolPromise: Promise<sql.ConnectionPool>;

export const getDb = async () => {
  if (!poolPromise) {
    if (!process.env.AZURE_SQL_SERVER) {
      console.warn("Missing Azure SQL credentials. Skipping connection.");
      return null;
    }
    poolPromise = sql.connect(sqlConfig)
      .then(pool => {
        console.log('Connected to Azure SQL');
        return pool;
      })
      .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        throw err;
      });
  }
  return poolPromise;
};

export { sql };
