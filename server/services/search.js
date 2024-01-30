// 'use strict';

// /**
//  *  service
//  */

// const { createCoreService } = require('@strapi/strapi').factories;

// module.exports = createCoreService('plugin::indexed-search.search');

"use strict";

const _ = require("lodash");
const deepPopulate = require("./../helpers/populate").default;

const loopThroughObject = (obj) => {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (Array.isArray(obj[key])) {
        // If the current field is an array, loop through its elements
        obj[key].forEach(function (element) {
          // Check if the element is an object
          if (typeof element === "object") {
            // If the element is an object, recursively call the function
            loopThroughObject(element);
          } else {
            // If the element is not an object, you can process it here
            console.log(key + ": " + element);
          }
        });
      } else if (typeof obj[key] === "object") {
        // If the current field is an object, recursively call the function
        loopThroughObject(obj[key]);
      } else {
        // If the current field is not an object or an array, you can process it here
        console.log(key + ": " + obj[key]);
      }
    }
  }
};

module.exports = ({ strapi }) => ({
  async globalSearch(ctx) {
    const { term, pagination } = ctx.request.query;
    const pageNumber = pagination?.page ? parseInt(pagination.page) : 1;
    const limit = parseInt(
      pagination?.pageSize ??
        strapi.config.get("constants.DEFAULT_RESPONSE_LIMIT")
    );
    const start = limit * (pageNumber - 1);

    //let query = `select *  from searches order by id offset ${start} limit ${limit};`;
    let query = `select * from searches where content ilike '%${term}%'`;

    const knex = strapi.db.connection.context;
    let queryResult = await knex.raw(query);

    const rowCount = queryResult?.rows?.length;
    const totalPages = Math.ceil(queryResult?.rows?.length / limit);
    //const nextPage = totalPages > pageNumber ? pageNumber + 1 : pageNumber;
    queryResult.rows = queryResult.rows.slice(start, pageNumber * limit);

    const searchGrouped = _.groupBy(queryResult.rows, "entity");

    let results = [];
    for (let key in searchGrouped) {
      let orderedList = _.map(searchGrouped[key], ({ entity_id }) => entity_id);
      let entity = {
        api: key,
        results: await strapi.entityService.findMany(key, {
          filters: {
            id: orderedList, //_.map(searchGrouped[key], ({ entity_id }) => entity_id),
          },
          populate: {
            Seo: true,
          },
        }),
      };
      entity.results = _.sortBy(entity.results, (obj) =>
        _.indexOf(orderedList, obj.id)
      );
      entity.results = _.map(entity.results, (item) => ({
        ...item,
        entity: key,
      }));
      results = results.concat(entity.results);
    }

    return {
      data: results,
      meta: {
        pagination: {
          page: pageNumber, //nextPage,
          pageSize: limit,
          pageCount: totalPages,
          total: rowCount,
        },
      },
    };
  },

  async syncEntries(ctx) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    let entities = strapi.config.get(
      "search.entities",
      "defaultValueIfUndefined"
    );

    let promises = [];
    for (const { code } of cultures) {
      for (let entity of entities) {
        //let condition = { populate: "*" };
        let condition = { populate: deepPopulate(entity.name), locale: code };
        if (entity.filters) {
          condition.filters = entity.filters;
        }

        let entries = await strapi.entityService.findMany(entity.name, {
          ///populate: "*",
          ...condition,
        });

        _.each(entries, (entry) => {
          let test = loopThroughObject(entry);

          let data = _.pick(entry, entity.fields);

          _.forOwn(data, function (value, key) {
            //data = { ...data, entity_id: entry.id, entity: entity.name };
            // promises.push(
            //   strapi.entityService.create("plugin::indexed-search.search", {
            //     data: {
            //       entity_id: entry.id,
            //       entity: entity.name,
            //       content: value,
            //     },
            //   })
            // );
          });
        });
      }
    }

    //await Promise.all(promises);

    return "data synced";
  },
});
