/* eslint-disable no-unused-vars */
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@strapi/design-system/Button";
import Download from "@strapi/icons/Download";
import { axiosInstance } from "./utils";
import { useNotification, useQueryParams } from "@strapi/helper-plugin";
import { useLocation } from "react-router-dom";
import { stringify } from "qs";
import { getData, getDataSucceeded } from "./actions";

const SyncButton = () => {
  const [displaySyncButton, setDisplaySyncButtonState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toggleNotification = useNotification();
  const { pathname } = useLocation();
  const [{ query }] = useQueryParams();
  const queryParam = `?${stringify(query, { encode: false })}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const path = `/api/strapi-search-multilingual/search/sync-all-entities-types`;
        const response = await axiosInstance.get(path);
        
        var model = pathname.split("/").reverse()[0];
 
        if (response.data.entities && response.data.entities.indexOf(model) > -1) {
          setDisplaySyncButtonState(true);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  
    // Optional cleanup function
    return () => {
    };
  }, [pathname]);

  const handleSync = useCallback(async () => {
    setIsLoading(true);
    var model = pathname.split('/').reverse()[0];
    await axiosInstance.get(`/api/strapi-search-multilingual/search/sync-all/?model=${model}`);

    try {
      getData();
      const path = `/content-manager/collection-types/${model}${queryParam}`;
      const {
        data: { results, pagination: paginationResult },
      } = await axiosInstance.get(path);
      getDataSucceeded(paginationResult, results);
      toggleNotification({
        type: 'success',
        message: 'Sync completed successfully',
      });
      setIsLoading(false);
      window.location.reload();
    } catch (err) {
      toggleNotification({
        type: 'error',
        message: 'Sync not completed',
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
