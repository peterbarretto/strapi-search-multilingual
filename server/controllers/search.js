// 'use strict';

// /**
//  *  controller
//  */

// const { createCoreController } = require('@strapi/strapi').factories;

// module.exports = createCoreController('plugin::indexed-search.search');

"use strict";

module.exports = ({ strapi }) => ({
  async index(ctx) {
    return await strapi
      .plugin("strapi-search-multilingual")
      .service("search")
      .globalSearch(ctx);
  },
  async syncEntries(ctx) {
    ctx.body = strapi
      .plugin("strapi-search-multilingual")
      .service("search")
      .syncEntries(ctx);
  },
  async syncAllEntitiesTypes(ctx) {
    return await strapi
      .plugin("strapi-search-multilingual")
      .service("search")
      .syncAllEntitiesTypes(ctx);
  },
  async autoComplete(ctx) {
    return await strapi
      .plugin("strapi-search-multilingual")
      .service("search")
      .autoComplete(ctx);
  },
});
