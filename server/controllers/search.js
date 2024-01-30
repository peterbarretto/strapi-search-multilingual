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
      .plugin("indexed-search-multilingual")
      .service("search")
      .globalSearch(ctx);
  },
  async syncEntries(ctx) {
    ctx.body = strapi
      .plugin("indexed-search-multilingual")
      .service("search")
      .syncEntries(ctx);
  },
});
