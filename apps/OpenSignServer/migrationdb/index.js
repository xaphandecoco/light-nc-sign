import createContactIndex from './createContactIndex.js';
import createDocumentIndex from './createDocumentIndex.js';
import resetContactPasswords from './resetContactPasswords.js';
import createNormalizedEmailUnique from './createNormalizedEmailUnqiue.js';

export default async function runDbMigrations() {
  await createContactIndex();
  await createDocumentIndex();
  await createNormalizedEmailUnique();
  await resetContactPasswords();
}
