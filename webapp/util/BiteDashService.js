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

    function createMenuItem(oInput) {
        return readCollection("Restaurants").then(function (aRestaurants) {
            aRestaurants = aRestaurants.filter(function (oRestaurant) {
                return oRestaurant.isActive !== false;
            });
            if (!aRestaurants.length) {
                throw new Error("CAP has no active restaurants.");
            }

            var oRestaurant = aRestaurants[0];
            var oPayload = {
                restaurant_ID: oRestaurant.ID,
                name: oInput.name,
                description: oInput.description || "",
                category: oInput.category || "Other",
                price: Number(oInput.price),
                currency: "INR",
                isAvailable: true
            };

            // In local BAS development, the UI5 proxy calls CAP directly.
            // The standalone CAP service does not issue an X-CSRF-Token.
            // When deployed behind an SAP Application Router, CSRF protection
            // is handled by the router.
            return window.fetch(SERVICE_ROOT + "/MenuItems", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(oPayload)
            }).then(function (oResponse) {
                if (!oResponse.ok) {
                    return oResponse.text().then(function (sBody) {
                        throw new Error(
                            "CAP could not create the menu item (HTTP " +
                            oResponse.status + "): " + sBody
                        );
                    });
                }
                return oResponse.json();
            }).then(function (oCreated) {
                return mapMenuItem(Object.assign({}, oPayload, oCreated), oRestaurant);
            });
        });
    }

    return {
        createMenuItem: createMenuItem,
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
