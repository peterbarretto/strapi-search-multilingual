module.exports = {
  search_filters: true,
    entities: [
      {
        name:  "api::initiative.initiative",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle",
        populate: { //you want to search inside the dynamic zone 'blocks.content-block' for the 'Content' field
          components: {
            on: {
              'blocks.content-block': { 
                populate: {
                  Content: true
                } 
              }
            }
          }
        }
      },
      {
        name:  "api::product.product",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle",
        filters: { 
          SearchPage:  true,
        },
      },
      {
        name:  "api::news.news",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle",
        populate: { //you want to search inside the component 'componentname' for the 'Description' field
          componentname: {    
            populate: {
              Description: true
            }        
          }
        }      
      },
    ],
    map: {
      others: [ 
        "api::initiative.initiative",
        "api::product.product",
        "api::news.news"
      ], 
      map_entity: [
      ],
      final_count: { 
        all: 0,
        "api::publication.publication":0,
        "api::product.product":0,
        "api::news.news": 0,
      },
    },
    default_populate: { //in the search result for each entry if you need additional fields to be fetched (relations/components which are not fetched by default findMany)
      PageSlug: true,
      Image: true,
      ParentPage: true,
    },
    custom_populate:[
      {
        name: "api::news.news",
        populate: {
          news_categories :true
        }
      }
    ],
    auto_complete:{
      search_by: 'startswith' //contains or startswith , default is startswith
    }
};
  