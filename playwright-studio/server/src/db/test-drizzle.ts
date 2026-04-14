import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Client } = pkg;
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const client = new Client({
    connectionString: "postgres://postgres:postgres@localhost:5432/postgres" // dummy
  });
  // don't even connect
  const db = drizzle(client, { schema });
  
  try {
    const query = db.select().from(schema.users).where(eq(schema.users.id, '1')).toSQL();
    console.log(query);
  } catch(e) {
    console.error(e.message);
  }
}
main();
