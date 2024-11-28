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

const getAllValues = (obj) => {
  const values = [];

  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      values.push(...getAllValues(obj[key]));
    } else {
      //if not id or component name then push value
      if (key !== "id" && key != "__component") values.push(obj[key]);
    }
  }

  return values;
};

module.exports = ({ strapi }) => ({
  async globalSearch(ctx) {
    const { term, pagination, locale = "en", type } = ctx.request.query;
    const pageNumber = pagination?.page ? parseInt(pagination.page) : 1;
    const limit = parseInt(
      pagination?.pageSize ??
        strapi.config.get("constants.DEFAULT_RESPONSE_LIMIT") ??
        10
    );
    const start = limit * (pageNumber - 1);
    const search = strapi.config.get("search", "defaultValueIfUndefined");
    const otherApis = search?.map?.others;
    const different_original = search?.map?.map_entity;
    let type_filter = ``;

    const bindings = { locale };
    const typeBindings = { locale };
    if (type) {
      if (otherApis.includes(type)) {
        const found = different_original.find(
          (element) => element.passed === type
        );
        type_filter = ` and entity = :type`;
        if (found) {
          type_filter += ` and original_entity = :original_entity`;
          bindings.original_entity = found.original_entity;
        }
        bindings.type = type;
      }
    }

    let filter_term = ``;
    if (term) {
      filter_term = `content ilike '%'||:term||'%' and`;
      bindings.term = term;
      typeBindings.term = term;
    }

    let query = `select Count(*),entity,entity_id,original_entity from searches where ${filter_term} locale=:locale ${type_filter}  group by entity,entity_id,original_entity`;

    const knex = strapi.db.connection.context;
    let queryResult = await knex.raw(query, bindings);

    let countRows = {};
    if (type) {
      let queryAll = `select Count(*),entity,entity_id from searches where ${filter_term} locale=:locale group by entity,entity_id`;
      let queryResultAll = await knex.raw(queryAll, typeBindings);
      countRows = _.groupBy(queryResultAll.rows, "entity");
    } else {
      countRows = _.groupBy(queryResult.rows, "entity");
    }
    const finalCount = search?.map?.final_count;

    for (const index in finalCount) {
      switch (index) {
        case "all":
          break;
        default:
          if (countRows[index] && countRows[index].length) {
            let count = finalCount[index] + countRows[index].length;
            finalCount[index] = count;
            finalCount["all"] += count;
          }
          break;
      }
    }

    const rowCount = queryResult?.rows?.length;
    const totalPages = Math.ceil(queryResult?.rows?.length / limit);

    queryResult.rows = queryResult.rows.slice(start, pageNumber * limit);

    const searchGrouped = _.groupBy(queryResult.rows, "entity");

    let results = [];
    for (let key in searchGrouped) {
      let queryKey = key;
      let orderedList = _.map(searchGrouped[key], ({ entity_id }) => entity_id);
      const populate = {
        Seo: true,
      };
      //if entity is company then populate Sector
      if (key == "api::company.company")
        populate.Sector = {
          fields: ["Title", "SectorSlug"],
        };
      if (searchGrouped[key][0]?.original_entity)
        queryKey = searchGrouped[key][0]?.original_entity;
      let entity = {
        api: key,
        results: await strapi.entityService.findMany(queryKey, {
          filters: {
            id: orderedList, //_.map(searchGrouped[key], ({ entity_id }) => entity_id),
          },
          populate,
          locale,
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
          allCounts: finalCount,
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

    const searchFilters = strapi.config.get("search.search_filters") || null;

    let promises = [];
    for (const { code } of cultures) {
      for (let entity of entities) {
        //let condition = { populate: "*" };
        if (!entity?.publishedAt) return true;
        if (searchFilters) {
          let searchEntity = _.find(
            entities,
            (item) => item.name === entity.name
          );
          const { fields, filters = {}, populate = {} } = searchEntity || {};

          const theEntities = await strapi.entityService.findMany(entity.name, {
            fields,
            filters: { ...filters }, // Spread existing filters with id
            populate,
            locale: code,
          });
          if (theEntities.length == 0) continue;

          _.each(theEntities, (entityItem) => {
            const Values = getAllValues(entityItem);
            _.each(Values, (item) => {
              if (item)
                strapi.entityService.create(
                  "plugin::indexed-search-multilingual.search",
                  {
                    data: {
                      entity_id: entityItem.id,
                      entity: searchEntity.name,
                      content: item,
                      locale: code,
                    },
                  }
                );
            });
          });
        } else {
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
    }

    await Promise.all(promises);

    return "data synced";
  },

  async syncSingleItem(entity, name) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    let searchEntity = _.filter(
      strapi.config.get("search.entities", "defaultValueIfUndefined"),
      (item) => item.name === name
    );
    const searchFilters = strapi.config.get("search.search_filters") || null;

    if(!entity?.publishedAt) return true;
    for (const { code } of cultures) {
      if (entity.locale === code) {
        if (searchFilters) {
          let theTitle = "";
          let theEntity = [];
          let skip = 0;
          let entityName = "";
          let originalEntity = "";
          if (searchEntity.length > 0) {
            if (searchEntity.length > 1) {
              for (const element of searchEntity) {
                if (skip == 0) {
                  let {
                    fields,
                    match_filters = {},
                    populate = {},
                    title = "PageTitle",
                  } = element || {};
                  theEntity = await strapi.entityService.findMany(
                    element.name,
                    {
                      fields,
                      filters: { ...match_filters, id: entity.id }, // Spread existing filters with id
                      populate,
                      locale: code,
                    }
                  );

                  if (theEntity.length == 1) {
                    theTitle = theEntity[0][title];
                    skip = 1;
                    entityName = element.frontend_entity;
                    originalEntity = element.name;
                  }
                }
              }
            } else {
              const {
                fields,
                filters = {},
                populate = {},
                title = "PageTitle",
              } = searchEntity[0] || {};
              entityName = searchEntity[0].name;
              theEntity = await strapi.entityService.findMany(
                searchEntity[0].name,
                {
                  fields,
                  filters: { ...filters, id: entity.id }, // Spread existing filters with id
                  populate,
                  locale: code,
                }
              );
              theTitle = theEntity[0][title];
              if (theEntity.length == 1 && searchEntity[0]?.frontend_entity) {
                entityName = searchEntity[0]?.frontend_entity;
                originalEntity = searchEntity.name;
              }
            }

            if (theEntity.length == 0) continue;

            const Values = getAllValues(theEntity);
            let content = "";
            _.each(Values, (item) => {
              if (item) {
                content += `  ${item}`;
              }
            });
            if (content) {
              strapi.entityService.create(
                "plugin::indexed-search-multilingual.search",
                {
                  data: {
                    entity_id: entity.id,
                    original_entity: originalEntity,
                    entity: entityName,
                    content,
                    locale: code,
                    title: theTitle,
                  },
                }
              );
            }
          }
        } else {
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
    }
  },
});
