"use strict";

module.exports = ({ strapi }) => {
  // registeration phase
  strapi.eventHub.addListener("entry.create", async (listener) => {
    const entities = strapi.config.get("search.entities");

    for (let entity of entities) {
      if (entity.name === listener.uid) {
        await strapi
          .plugin("strapi-search-multilingual")
          .service("search")
          .syncSingleItem(listener.entry, entity.name);
      }
    }
  });

  strapi.eventHub.addListener("entry.update", async (listener) => {
    const entities = strapi.config.get("search.entities");

    for (let entity of entities) {
      if (entity.name === listener.uid && !entity?.repeated) {
        const where = {
          entity_id: listener.entry.id,
          entity: listener.uid,
        };
        if (entity?.frontend_entity) {
          where.original_entity = listener.uid;
          delete where.entity;
        }
        strapi.db
          .query("plugin::strapi-search-multilingual.search")
          .deleteMany({
            where,
          });
        await strapi
          .plugin("strapi-search-multilingual")
          .service("search")
          .syncSingleItem(listener.entry, entity.name);
      }
    }
  });

  strapi.eventHub.addListener("entry.delete", async (listener) => {
    const entities = strapi.config.get("search.entities");

    for (let entity of entities) {
      if (entity.name === listener.uid && !entity?.repeated) {
        const where = {
          entity_id: listener.entry.id,
          entity: listener.uid,
        };
        if (entity?.frontend_entity) {
          where.original_entity = listener.uid;
          delete where.entity;
        }
        strapi.db
          .query("plugin::strapi-search-multilingual.search")
          .deleteMany({
            where,
          });
      }
    }
  });
};
