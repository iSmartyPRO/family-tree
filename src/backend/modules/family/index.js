import { ensureFamilySchema } from './schema.js';
import { privateRoutes, publicRoutes } from './routes.js';

/** Family tree module descriptor (see modules/index.js for the contract). */
export default {
  id: 'family',
  schema: ensureFamilySchema,
  routes: privateRoutes,
  publicRoutes,
  publicPrefix: '/t',
};
