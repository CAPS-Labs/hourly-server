import {Pool} from 'pg';

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL, //need to set an .env file
    max: 10,
    idleTimeoutMillis: 30000, //Times out after 30s of idle
    connectionTimeoutMillis: 5000,  //Times out after 5s if connection fails
});

