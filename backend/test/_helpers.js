import { PGlite } from '@electric-sql/pglite';
import { migrate, seed } from '../scripts/database-tasks.js';
import { catalogueRepository } from '../src/catalogue.js';
import { applicationsRepository } from '../src/applications.js';
import { createApp } from '../src/app.js';

export const userA = '11111111-1111-4111-8111-111111111111';
export const userB = '22222222-2222-4222-8222-222222222222';

export async function createTestContext() {
  const db = new PGlite();
  const client = {
    query: (sql, params) => params || !sql.includes(';')
      ? db.query(sql, params)
      : db.exec(sql).then(results => results.at(-1)),
  };

  await migrate(client);
  await seed(client);
  const catalogue = catalogueRepository(client);
  const applications = applicationsRepository(client);
  const documentTypeId = (await catalogue.list())[0].id;
  const app = createApp({
    catalogue,
    applications,
    verifyToken: async token => {
      if (token === 'user-a') return userA;
      if (token === 'user-b') return userB;
      throw new Error('Invalid test token');
    },
    logger: { error() {} },
  });

  return { db, client, catalogue, applications, documentTypeId, app };
}
