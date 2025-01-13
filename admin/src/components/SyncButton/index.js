/* eslint-disable no-unused-vars */
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@strapi/design-system/Button";
import Download from "@strapi/icons/Download";
import { axiosInstance } from "./utils";
import { useNotification, useQueryParams } from "@strapi/helper-plugin";
import { useLocation } from "react-router-dom";
import { stringify } from "qs";
import { getData, getDataSucceeded } from "./actions";
import { COLLECTION_ENTITIES } from "./constants";

const SyncButton = () => {
  const [displaySyncButton, setDisplaySyncButtonState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toggleNotification = useNotification();
  const { pathname } = useLocation();
  const [{ query }] = useQueryParams();
  const queryParam = `?${stringify(query, { encode: false })}`;
  // console.log("queryParam:", queryParam);
  useEffect(async() => {
    var model = pathname.split("/").reverse()[0];
    try {
      const path = `/api/strapi-search-multilingual/search/sync-all-entities-types`;
          const { data:{entities} } = await axiosInstance.get(path);
       //console.log("entities:", entities);
      if (entities && entities.indexOf(model) > -1) {
        setDisplaySyncButtonState(true);
      }
    } catch (err) {
      console.log("ERROR: ",err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setIsLoading(true);
    var model = pathname.split("/").reverse()[0];
    await axiosInstance.get(`/api/strapi-search-multilingual/sync/sync`);

    try {
      getData();
      const path = `/content-manager/collection-types/${model}${queryParam}`;
      const {
        data: { results, pagination: paginationResult },
      } = await axiosInstance.get(path);
      getDataSucceeded(paginationResult, results);
      toggleNotification({
        type: "success",
        message: "Sync completed successfully",
      });
      setIsLoading(false);
      window.location.reload();
    } catch (err) {
      toggleNotification({
        type: "error",
        message: "Sync not completed",
      });
    }
  }, [toggleNotification, getData, getDataSucceeded]);

  return (
    <div>
      {displaySyncButton && (
        <Button
          variant="secondary"
          disabled={isLoading}
          loader={isLoading}
          startIcon={<Download />}
          onClick={handleSync}
        >
          Sync Search Items
        </Button>
      )}
    </div>
  );
};

export default SyncButton;
