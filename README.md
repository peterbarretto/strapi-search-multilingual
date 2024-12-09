# Strapi plugin search multilingual

![](https://github.com/peterbarretto/strapi-search-multilingual)

Working on Strapi version: v4

## First Setup

1. Install as an npm dependency

```bash
# install dependencies
npm install strapi-search-mulitlingual

```

2. Add the configuration as shown in search.config.example.js in config/search.js

## Note
```bash
#entities has all the entities that need to be searched
#name - is the collection that is present in strapi
#fields - all the fields that need to be searched in the strapi collection
#title - is used to specify the field that will be search for auto complete feature
#match_filters - this is used to filter if the same collection has two different entities that need to be shown as different tabs on the search page
#frontend_entity - this is the entity name that is used on the frontend tabs to differentiate  
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
        frontend_entity: "api::publication.publication",
        repeated :1
      },
      {
        name:  "api::initiative.initiative",
        fields: ["PageTitle", "ShortDescription"],
        title: "PageTitle"
      },
    ],
```
- 
## Features

- Simple search plugin

## References

- [Forked from ](pdalvi1893/strapi-indexed-search-multilingual)
