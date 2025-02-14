"use strict";

/**
 *  router
 */

module.exports = {
  type: "content-api", // other type available: admin.
  routes: [
    {
      method: 'GET',
      path: '/search',
      handler: 'search.index',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/search/sync-all',
      handler: 'search.syncEntries',
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/search/sync-all-entities-types',
      handler: 'search.syncAllEntitiesTypes',
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/search/autocomplete',
      handler: 'search.autoComplete',
      config: {
        policies: [],
      },
    },
  ],
};
