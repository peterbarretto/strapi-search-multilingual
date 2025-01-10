module.exports = {
  search_filters: true,
    entities: [
      {
        name:  "api::initiative.initiative",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle"
      },
      {
        name:  "api::product.product",
        fields: ["PageTitle", "ShortDescription"], //only search for text in the mentioned fields
        title: "PageTitle", //specify the title field in a collection which will be used for autocomplete funtionality
        filters: { //only make entries searchable who fulfill the below conditions
          SearchPage:  true,
        },
      },
    ],
    map: {
      others: [ 
        "api::initiative.initiative",
        "api::product.product",
      ], 
      map_entity: [
      ],
      final_count: { 
        all: 0,
        "api::publication.publication":0,
        "api::product.product":0,
      },
    },
    default_populate: { //in the search result for each entry if you need additional fields to be fetched (relations/components which are not fetched by default findMany)
      PageSlug: true,
      Image: true,
      ParentPage: true,
    },
    custom_populate:[
    ],
    auto_complete:{
      search_by: 'startswith' //contains or startswith , default is startswith
    }
};
  