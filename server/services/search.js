"use strict";

const _ = require("lodash");

const OMITTED_FIELDS = [
  "localizations",
  "createdBy",
  "createdAt",
  "publishedAt",
  "updatedAt",
  "updatedBy",
  "locale",
  "id",
];

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
        const found = different_original.filter(
          (element) => element.passed === type
        );
        type_filter = ` and entity = :type`;
        if (found.length>0) {
          type_filter += ` and ( `;
          let i = 1;
          let theKey = '';
          for (const each of found){
            if(i!==1)
              type_filter += ` OR `;
            type_filter += `original_entity = :original_entity${i}`;
            theKey = `original_entity${i}`
            bindings[theKey] = each.original_entity
            i++;
          }
          type_filter += ` ) `;
          
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
      let queryAll = `select Count(*),entity,entity_id,original_entity from searches where ${filter_term} locale=:locale group by entity,entity_id,original_entity`;
      let queryResultAll = await knex.raw(queryAll, typeBindings);
      countRows = _.groupBy(queryResultAll.rows, "entity");
    } else {
      countRows = _.groupBy(queryResult.rows, "entity");
    }
    const finalCount = Object.assign({}, search?.map?.final_count);

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

    const searchGrouped = _.groupBy(queryResult.rows, (item) => {
      // Create a composite key from multiple columns
      return `${item.entity}_${item.original_entity || 'default'}`;
    });

    let results = [];
    for (let compositeKey in searchGrouped) {
      // Split the composite key if needed
      const [theentity, originalEntity] = compositeKey.split('_');

      let populate = search?.default_populate || {};
      const customPopulate = search?.custom_populate || {};

      //get custom populate
      if (customPopulate.length > 0) {
        const custom = _.find(customPopulate, (item) => item.name === theentity ||item.name===originalEntity);
        if (custom) {
          populate = { ...populate, ...custom.populate };
        }
      }

      let queryKey = originalEntity !== 'default' ? originalEntity : theentity;

      let orderedList = _.map(searchGrouped[compositeKey], ({ entity_id }) => entity_id);
      let entity = {
        api: theentity,
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
        entity: theentity,
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

    const searchFilters = strapi.config.get("search.search_filters") || null;
    const { model = '' } = ctx.request.query;
    if(model=='')
      return false;
    if(!searchFilters)
      return false;
    const searchEntities = _.filter(
      strapi.config.get("search.entities", {}),
      (item) => item.name === model
    );
    //delete all the old entries
    const where = {
      $or : [
        {
          entity: model,
        },
        {
          original_entity: model,
        }
      ]  
    };
    strapi.db
      .query("plugin::strapi-search-multilingual.search")
      .deleteMany({
        where,
      });
   
    for (const searchEntity of searchEntities) {
      for (const { code } of cultures) {
        await this.processSearchFiltersSyncAll(searchEntity, code);
      }
    }  

    return "data synced";
  },


  async processSearchFiltersSyncAll(searchEntity, locale) {
  
      const {
        fields,
        filters = {},
        match_filters = {},
        populate = {},
        title = "PageTitle",
        frontend_entity,
      } = searchEntity;

      const entities = await strapi.entityService.findMany(searchEntity.name, {
        fields,
        filters: { ...filters, ...match_filters },
        populate,
        locale,
      });

      for (const entity of entities) {
        const theTitle = entity[title];
        const originalEntity = frontend_entity ? searchEntity.name : '';
        const entityName = frontend_entity || searchEntity.name;

        await this.createSearchEntry(entity.id, entityName, originalEntity, locale, theTitle, entity);
      }
      return true;
  },

  async syncSingleItemOld(entity, name) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    let searchEntity = _.filter(
      strapi.config.get("search.entities", "defaultValueIfUndefined"),
      (item) => item.name === name
    );
    const searchFilters = strapi.config.get("search.search_filters") || null;

    //check if content type has draft mode
    const contentType = await strapi.plugin('content-manager').service('content-types').findContentType(name);

    //if draft mode exist then skip the entry if not published
    if (contentType?.options?.draftAndPublish === true && !entity?.publishedAt) return true;

    for (const { code } of cultures) {
      if (entity.locale === code || cultures.length==1) {
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
                "plugin::strapi-search-multilingual.search",
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
                "plugin::strapi-search-multilingual.search",
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

  async syncSingleItem(entity, name) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    const searchEntities = _.filter(
      strapi.config.get("search.entities", "defaultValueIfUndefined"),
      (item) => item.name === name
    );
    const searchFilters = strapi.config.get("search.search_filters") || null;

    const contentType = await strapi
      .plugin("content-manager")
      .service("content-types")
      .findContentType(name);

    // Early return if content type has draft mode and entity isn't published
    if (contentType?.options?.draftAndPublish === true && !entity?.publishedAt) return true;

    for (const { code } of cultures) {
      if (entity.locale !== code && cultures.length > 1) continue;

      if (searchFilters) {
        if(searchEntities.length>1)
          await this.processWithSearchFiltersMany(entity, searchEntities, code);
        else
          await this.processWithSearchFiltersOne(entity, searchEntities, code);
      } else {
        await this.processWithoutSearchFilters(entity, searchEntities, code);
      }
    }
    return true;
  },

  async processWithSearchFiltersOne(entity, searchEntities, locale) {

    const searchEntity = searchEntities[0];
   
      const {
        fields,
        filters = {},
        populate = {},
        title = "PageTitle",
        frontend_entity,
      } = searchEntity;

      const entities = await strapi.entityService.findMany(searchEntity.name, {
        fields,
        filters: { ...filters, id: entity.id },
        populate,
        locale,
      });

      if (entities.length === 1 ) {
        const theTitle = entities[0][title];
        const originalEntity = frontend_entity ? searchEntity.name : '';
        const entityName = frontend_entity || searchEntity.name;

        await this.createSearchEntry(entity.id, entityName, originalEntity, locale, theTitle, entities);
      }
      return true;
  },

  async processWithSearchFiltersMany(entity, searchEntities, locale) {
    let skip = false;

    for (const searchEntity of searchEntities) {
      if (skip) break;

      const {
        fields,
        match_filters = {},
        populate = {},
        title = "PageTitle",
        frontend_entity,
      } = searchEntity;

      const entities = await strapi.entityService.findMany(searchEntity.name, {
        fields,
        filters: { ...match_filters, id: entity.id },
        populate,
        locale,
      });

      if (entities.length == 1) {
        const theTitle = entities[0][title];
        const originalEntity = frontend_entity ? searchEntity.name : '';
        const entityName = frontend_entity || searchEntity.name;

        await this.createSearchEntry(entity.id, entityName, originalEntity, locale, theTitle, entities);
        skip = true;
      }
    }
    return true;
  },

  async processWithoutSearchFilters(entity, searchEntities, locale) {
    const propArray = navigateObject(_.omit(entity, OMITTED_FIELDS));

    _.each(propArray, (item) => {
      const fieldName = Object.keys(item)[0];
      if (searchEntities[0].fields.includes(fieldName)) {
        strapi.entityService.create("plugin::strapi-search-multilingual.search", {
          data: {
            entity_id: entity.id,
            entity: searchEntities[0].name,
            content: item[fieldName],
            locale,
          },
        });
      }
    });
    return true;
  },

async createSearchEntry(entityId, entityName, originalEntity, locale, title, entities) {
  const content = getAllValues(entities)
    .filter(Boolean)
    .join("  ");

  if (content) {
    strapi.entityService.create("plugin::strapi-search-multilingual.search", {
      data: {
        entity_id: entityId,
        original_entity: originalEntity,
        entity: entityName,
        content,
        locale,
        title,
      },
    });
  }
  return true;
},

async autoComplete(ctx) {
    const { term, locale } = ctx.request.query;
    const search = strapi.config.get("search", "defaultValueIfUndefined");

    //check if to search with contains or startwith strapi filter
    const auto_complete = search?.auto_complete?.search_by && search.auto_complete.search_by === 'contains' ? '$containsi' : '$startsWithi';
    const title = {
      [auto_complete]:term
    };
    const theEntities = await strapi.entityService.findMany(
      "plugin::strapi-search-multilingual.search",
      {
        fields: ["title"],
        filters: {
          title,
        },
        locale,
      }
    );

    return { data: _.map(theEntities, ({ title }) => title) };
  },
  
  async syncAllEntitiesTypes(ctx) {
    const entities = strapi.config.get("search.sync_entities", [])||[];
    return { entities};
  }
});
