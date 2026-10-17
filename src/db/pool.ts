import { Pool, types } from 'pg';

// keep DATE (oid 1082) as a 'YYYY-MM-DD' string, JS Date shifts it by timezone
types.setTypeParser(1082, (value: string) => value);

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}
