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

const DEFAULT_LIMIT = 10;

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
  // Helper function to generate the type filter with bindings
  async generateTypeFilter(type, otherEntityApis, mappedEntities, bindings) {
    if (!type || !otherEntityApis.includes(type)) return { typeFilter: '', bindings };

    const matchingEntities = mappedEntities.filter((entity) => entity.passed === type);
    let typeFilter = ` and entity = :type`;

    if (matchingEntities.length > 0) {
      typeFilter += ` and ( `;
      matchingEntities.forEach((entity, index) => {
        if (index !== 0) typeFilter += ` OR `;
        const bindingKey = `original_entity${index + 1}`;
        typeFilter += `original_entity = :${bindingKey}`;
        bindings[bindingKey] = entity.original_entity;  
      });
      typeFilter += ` ) `;
    }

    bindings.type = type;
    return { typeFilter, bindings };
  },

  // Helper function for custom populate configuration
  async getPopulateConfiguration(searchConfig, entityName) {
    let populate = searchConfig?.default_populate || {};
    const customPopulate = searchConfig?.custom_populate || [];
    const customConfig = customPopulate.find((item) => item.name === entityName);
    if (customConfig) {
      populate = { ...populate, ...customConfig.populate };
    }
    return populate;
  },

  async globalSearch(ctx) {
    const { term, pagination, locale = "en", type } = ctx.request.query;

    // Pagination Setup
    const pageNumber = parseInt(pagination?.page ?? 1);
    const limit = parseInt(
      pagination?.pageSize ??
      strapi.config.get("constants.DEFAULT_RESPONSE_LIMIT", DEFAULT_LIMIT)
    );
    const start = limit * (pageNumber - 1);

    // Config and Mappings
    const searchConfig = strapi.config.get("search", "defaultValueIfUndefined");
    const otherEntityApis = searchConfig?.map?.others || [];
    const mappedEntities = searchConfig?.map?.map_entity || [];
    
    // Generate Filters
    const bindings = { locale };
    let { typeFilter, bindings: updatedBindings } = await this.generateTypeFilter(type, otherEntityApis, mappedEntities, bindings);
    let contentFilter = term ? `content ilike '%'||:term||'%' and` : '';
    if (term) updatedBindings.term = term;

    // Main Query
    const query = `SELECT Count(*), entity, entity_id, original_entity FROM searches WHERE ${contentFilter} locale=:locale ${typeFilter} GROUP BY entity, entity_id, original_entity`;
    const knex = strapi.db.connection.context;
    const queryResult = await knex.raw(query, updatedBindings);

    // Type-specific Query for Counts
    let countRows = {};
    if (type) {
      const allEntitiesQuery = `SELECT Count(*), entity, entity_id, original_entity FROM searches WHERE ${contentFilter} locale=:locale GROUP BY entity, entity_id, original_entity`;
      const queryResultAll = await knex.raw(allEntitiesQuery, updatedBindings);
      countRows = _.groupBy(queryResultAll.rows, "entity");
    } else {
      countRows = _.groupBy(queryResult.rows, "entity");
    }

    // Update Final Counts
    const finalCount = { ...searchConfig?.map?.final_count };
    for (const [index, value] of Object.entries(finalCount)) {
      if (index !== "all" && countRows[index]?.length) {
        let count = finalCount[index] + countRows[index].length;
        finalCount[index] = count;
        finalCount["all"] += count;
      }
    }

    // Pagination
    const rowCount = queryResult?.rows?.length;
    const totalPages = Math.ceil(rowCount / limit);
    queryResult.rows = queryResult.rows.slice(start, pageNumber * limit);

    // Group Data by Entity
    const groupedSearchResults = _.groupBy(queryResult.rows, (item) =>
      `${item.entity}_${item.original_entity || 'default'}`
    );
    let results = [];
    for (const compositeKey in groupedSearchResults) {
      const [entityName, originalEntity] = compositeKey.split('_');
      const populate = await this.getPopulateConfiguration(searchConfig, entityName);
      const queryKey = originalEntity !== "default" ? originalEntity : entityName;

      const orderedList = _.map(groupedSearchResults[compositeKey], ({ entity_id }) => entity_id);
      let entityResults = await strapi.entityService.findMany(queryKey, {
        filters: { id: orderedList },
        populate,
        locale,
      });

      entityResults = _.map(
        _.sortBy(entityResults, (obj) => _.indexOf(orderedList, obj.id)),
        (item) => ({ ...item, entity: entityName })
      );
      results = results.concat(entityResults);
    }

    return {
      data: results,
      meta: {
        pagination: {
          page: pageNumber,
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
    const { model = "" } = ctx.request.query;
    if (model == "") return false;
    if (!searchFilters) return false;
    const searchEntities = _.filter(
      strapi.config.get("search.entities", {}),
      (item) => item.name === model
    );
    //delete all the old entries
    const where = {
      $or: [
        {
          entity: model,
        },
        {
          original_entity: model,
        },
      ],
    };
    strapi.db.query("plugin::strapi-search-multilingual.search").deleteMany({
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
      const originalEntity = frontend_entity ? searchEntity.name : "";
      const entityName = frontend_entity || searchEntity.name;

      await this.createSearchEntry(
        entity.id,
        entityName,
        originalEntity,
        locale,
        theTitle,
        entity
      );
    }
    return true;
  },


  async syncSingleItem(entity, name) {
    const cultures = await strapi.plugins.i18n.services.locales.find();
    const defaultLocale = await strapi.plugins.i18n.services.locales.getDefaultLocale();

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
    if (contentType?.options?.draftAndPublish === true && !entity?.publishedAt)
      return true;

    for (const { code } of cultures) {
      //check to run only for the specific locale
      //if two locales for site but collection has single locale then exit for the non-default locale
      if ((entity.locale !== code && cultures.length > 1 && contentType?.pluginOptions?.i18n?.localized)
        ||(!contentType?.pluginOptions?.i18n?.localized && defaultLocale!==code)) continue;

      if (searchFilters) {
        if (searchEntities.length > 1)
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

    if (entities.length === 1) {
      const theTitle = entities[0][title];
      const originalEntity = frontend_entity ? searchEntity.name : "";
      const entityName = frontend_entity || searchEntity.name;

      await this.createSearchEntry(
        entity.id,
        entityName,
        originalEntity,
        locale,
        theTitle,
        entities
      );
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
        const originalEntity = frontend_entity ? searchEntity.name : "";
        const entityName = frontend_entity || searchEntity.name;

        await this.createSearchEntry(
          entity.id,
          entityName,
          originalEntity,
          locale,
          theTitle,
          entities
        );
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
        strapi.entityService.create(
          "plugin::strapi-search-multilingual.search",
          {
            data: {
              entity_id: entity.id,
              entity: searchEntities[0].name,
              content: item[fieldName],
              locale,
            },
          }
        );
      }
    });
    return true;
  },

  async createSearchEntry(
    entityId,
    entityName,
    originalEntity,
    locale,
    title,
    entities
  ) {
    const content = getAllValues(entities).filter(Boolean).join("  ");

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
    const auto_complete =
      search?.auto_complete?.search_by &&
      search.auto_complete.search_by === "contains"
        ? "$containsi"
        : "$startsWithi";
    const title = {
      [auto_complete]: term,
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
    const entities = strapi.config.get("search.sync_entities", []) || [];
    return { entities };
  },
});
