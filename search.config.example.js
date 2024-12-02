module.exports = {
    entities: [
      { 
        name: "api::news-and-publication.news-and-publication",
        fields: ["PageTitle", "Type","PageSlug"],
        title: "PageTitle",
        match_filters: { Type: "News" },
        frontend_entity: "api::news.news"
      },
      { 
        name: "api::news-and-publication.news-and-publication",
        fields: ["PageTitle","Type"],
        title: "PageTitle",
        match_filters: { Type: "Publication" },
        frontend_entity:"api::publication.publication",
        repeated :1
      },
      {
        name:  "api::initiative.initiative",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle"
      },
    ],
    search_filters: true,
    map:{
      others: [
        "api::program.program",
        "api::resource.resource",
        "api::initiative.initiative",
        "api::news.news",
        "api::publication.publication"
      ],
      map_entity: [
        {
          passed: "api::news.news",
          original_entity: "api::news-and-publication.news-and-publication",
          filters: { Type: "News" },
        },
        {
          passed: "api::publication.publication",
          original_entity: "api::news-and-publication.news-and-publication",
          filters: { Type: "Publication" },
        },
      ],
      final_count : {
        all: 0,
        "api::program.program":0,
        "api::resource.resource":0,
        "api::initiative.initiative":0,
        "api::news.news":0,
        "api::publication.publication":0
      }
    },
    default_populate:{
      PageSlug: true,
      Thumbnail: true
    },
    custom_populate:[
      {
        name: "api::news.news",
        populate: {
          news_categories :true
        }
      }
    ],
    autocomplete:{
      search_by: 'startswith' //contains or startswith is default
    }
  };
  