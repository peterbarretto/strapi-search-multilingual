"use strict";

module.exports = (strapi) => {
  // register phase
  strapi.strapi.controllers["content-types"].sync = async (ctx) => {
    try {
      const { model } = ctx.params;

      const modelName = strapi.getModel(model).modelName;

      switch (modelName) {
        case "api":
          await strapi.service(model).cronSyncCities(ctx);
          break;
      }
      return { success: true };
    } catch (error) {
      return false;
    }
  };
};
