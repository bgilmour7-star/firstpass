// Temporary helper for the U9 batch: validate only the given drill ids.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drillSchema } from '../src/lib/drills/schema';
let bad = 0;
for (const id of process.argv.slice(2)) {
  const r = drillSchema.safeParse(JSON.parse(readFileSync(join(__dirname, '..', 'content', 'drills', `${id}.json`), 'utf8')));
  if (r.success) console.log(`ok    ${id}`);
  else { bad++; console.log(`FAIL  ${id}`); for (const i of r.error.issues) console.log(`      ${i.path.join('.')}: ${i.message}`); }
}
process.exit(bad ? 1 : 0);
