sap.ui.define([], function () {
    "use strict";

    var SERVICE_ROOT = "/odata/v1/bitedash";

    function readCollection(sEntitySet) {
        return window.fetch(SERVICE_ROOT + "/" + sEntitySet, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        }).then(function (oResponse) {
            if (!oResponse.ok) {
                throw new Error(
                    sEntitySet + " request failed with HTTP " + oResponse.status
                );
            }
            return oResponse.json();
        }).then(function (oPayload) {
            if (!oPayload || !Array.isArray(oPayload.value)) {
                throw new Error(
                    "Unexpected CAP response for " + sEntitySet +
                    ". Expected an OData V4 value array."
                );
            }
            return oPayload.value;
        });
    }

    function mapMenuItem(oItem, oRestaurant) {
        return {
            ID: oItem.ID,
            Name: oItem.name || "",
            Description: oItem.description || "",
            Price: Number(oItem.price) || 0,
            Available: oItem.isAvailable !== false,
            Category: oItem.category || "Other",
            CategoryNames: oItem.category || "Other",
            Rating: 4.5,
            RestaurantID: oRestaurant.ID,
            RestaurantName: oRestaurant.name,
            Currency: oItem.currency || "INR",
            ImageUrl: oItem.imageUrl || ""
        };
    }

    return {
        loadMenu: function () {
            return Promise.all([
                readCollection("Restaurants"),
                readCollection("MenuItems")
            ]).then(function (aResults) {
                var aRestaurants = aResults[0].filter(function (oRestaurant) {
                    return oRestaurant.isActive !== false;
                });
                var aMenuItems = aResults[1];

                if (!aRestaurants.length) {
                    throw new Error("CAP has no active restaurants.");
                }

                // Phase 2.1 uses the first active restaurant as the initial
                // restaurant context. Multi-restaurant selection comes later.
                var oRestaurant = aRestaurants[0];
                var aProducts = aMenuItems.filter(function (oItem) {
                    return oItem.restaurant_ID === oRestaurant.ID;
                }).map(function (oItem) {
                    return mapMenuItem(oItem, oRestaurant);
                });

                var mCategories = {};
                aProducts.forEach(function (oProduct) {
                    mCategories[oProduct.Category] = true;
                });

                return {
                    restaurant: oRestaurant,
                    products: aProducts,
                    categories: Object.keys(mCategories).sort().map(function (sName, iIndex) {
                        return {
                            ID: String(iIndex + 1),
                            Name: sName
                        };
                    })
                };
            });
        }
    };
});
