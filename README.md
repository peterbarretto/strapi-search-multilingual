# Strapi search plugin multilingual

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
# install dependencies
npm install strapi-search-mulitlingual

```

2. Add the configuration as shown in search.config.example.js in config/search.js
Example configuration given below.

## Note
1. Main configurations:
```bash
#search_filters: has to set to true to use the below keys
#entities has all the entities that need to be searched
#name - is the collection that is present in strapi
#fields - all the fields that need to be searched in the strapi collection
#title - is used to specify the field that will be search for auto complete feature
#match_filters - this is used to filter if the same collection has two different entities that need to be shown as different tabs on the search page
#frontend_entity - this is the entity name that is used on the frontend tabs to differentiate

```
2. Other configurations:
```bash
#map.others - this is used to set the list of filters that need to be filtered in the search results
#map.map_entity - this is used to fetch the details of the entity if original_entity is set for the result entries
#map.final_count - this is used to set all the counts that you want to use in the frontend result
#default_populate - this is the default populate when fetching each entries details
#custom_populate - this is for custom populating when fetching each entries details for the specified collection

```
3. Global search details:
```bash

# global search api url - `/strapi-search-multilingual/search/?locale=en&type=api::publication.publication&term=a&pagination[page]=2&pagination`[pageSize]=10
#locale - is the locale that is to be fetched from strapi
#term - is the keyword that is used to search in the 'content' field in strapi search collection
#type - is the type of collection to filter by, field 'entity' in strapi search collection
#pagination.page - is page number to fetch the results from
#pagination.pageSize - is the number of entries needed per page


```
3. Autocomplete search details:
```bash

#auto_complete.search_by - is used for the autocomplete api whether to search the TITLE field using $startswith or $containi

#auto complete api url `/strapi-search-multilingual/search/autocomplete?locale=en&term=a`
#locale - is the locale that is to be fetched from strapi
#term - is the keyword that is used to search in the 'title' field in strapi search collection


```
4. Example configurations:
```bash
    search_filters: true,
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
    map: {
      others: [ 
        "api::publication.publication",
        "api::api::news.news",
        "api::initiative.initiative"
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
      final_count: { 
        all: 0,
        "api::initiative.initiative":0,
        "api::news.news":0,
        "api::publication.publication":0
      },
    },
    default_populate: {
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

#search in the component for specific field, add this in entities under the specific collection
    populate: { 
      componentname: {    
        populate: {
          Description: true
        }        
      }
    }    

#searching in the dynamic zone for specific field
#search in the dynamic zone named 'blocks' which is inside the field 'dynamiczone' in that specific collection
#search inside the component 'content-block' for the field 'Description'
#so we want to search the 'Description' field inside a dynamic zone
    populate: { 
      dynamiczone: {
        on: {
          'blocks.content-block': { 
            populate: {
              Description: true
            } 
          }
        }
      }
    }    
```
- 
## Features

- Simple search plugin for __strapi 4__, which searches in __components__ and __dynamic zones__ also if needed
- These components and dynamic zones field can be put in the populate in the entities search config
- There is global search at `/strapi-search-multilingual/search?term=searchtext`
- There is __Auto complete__ which returns array of titles at `/strapi-search-multilingual/search/autocomplete?term=searchtext`
- __Sync All function is not up to date - needs to be updated__

## References

- [Forked from ](pdalvi1893/strapi-indexed-search-multilingual)
