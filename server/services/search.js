// 'use strict';

// /**
//  *  service
//  */

// const { createCoreService } = require('@strapi/strapi').factories;

// module.exports = createCoreService('plugin::indexed-search.search');

"use strict";

const _ = require("lodash");
const deepPopulate = require("./../helpers/populate").default;

const navigateObject = (obj) => {
  let result = [];

  for (let key in obj) {
    // Check if the property is part of the object and not its prototype
    if (obj.hasOwnProperty(key)) {
      if (
        typeof obj[key] !== "object" &&
        !Array.isArray(obj[key]) &&
        obj[key] !== null
      ) {
        console.log("Key:", key, "Value:", obj[key]);
        result.push({ [key]: obj[key] });
      }

      // If the property is an object, call the function recursively
      if (typeof obj[key] === "object" && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          // If it's an array, iterate through its elements
          obj[key].forEach((element) => {
            if (typeof element === "object" && element !== null) {
              //navigateObject(element);
              result = result.concat(navigateObject(element));
            } else {
              //console.log("Array Element:", element);
              result.push(element);
            }
          });
        } else {
          // It's an object, not an array
          //navigateObject(obj[key]);
          result = result.concat(navigateObject(obj[key]));
        }
      }
    }
  }

  return result;
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
          ...condition,
        });

        _.each(entries, (entry) => {
          let propArray = navigateObject(
            _.omit(entry, [
              "localizations",
              "createdBy",
              "createdAt",
              "publishedAt",
              "updatedAt",
              "updatedBy",
              "locale",
              "id",
            ])
          );

          _.each(propArray, (item, key) => {
            if (entity.fields.indexOf(Object.keys(item)[0]) > -1) {
              promises.push(
                strapi.entityService.create(
                  "plugin::indexed-search-multilingual.search",
                  {
                    data: {
                      entity_id: entry.id,
                      entity: entity.name,
                      content: item[Object.keys(item)[0]],
                      locale: code,
                    },
                  }
                )
              );
            }
          });
        });
      }
    }

    await Promise.all(promises);

    return "data synced";
  },

  async syncSingleItem(entity, name) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    let searchEntity = _.find(
      strapi.config.get("search.entities", "defaultValueIfUndefined"),
      (item) => item.name === name
    );

    for (const { code } of cultures) {
      if (entity.locale === code) {
        let propArray = navigateObject(
          _.omit(entity, [
            "localizations",
            "createdBy",
            "createdAt",
            "publishedAt",
            "updatedAt",
            "updatedBy",
            "locale",
            "id",
          ])
        );

        _.each(propArray, (item, key) => {
          if (searchEntity.fields.indexOf(Object.keys(item)[0]) > -1) {
            strapi.entityService.create(
              "plugin::indexed-search-multilingual.search",
              {
                data: {
                  entity_id: entity.id,
                  entity: searchEntity.name,
                  content: item[Object.keys(item)[0]],
                  locale: code,
                },
              }
            );
          }
        });
      }
    }
  },
});
