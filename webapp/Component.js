
sap.ui.define([
    "sap/ui/core/UIComponent",
    "bitedash/bitedash/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("bitedash.bitedash.Component", {

        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {

            // Initialize base component
            UIComponent.prototype.init.apply(this, arguments);

            // Device model
            this.setModel(
                models.createDeviceModel(),
                "device"
            );

            // Application model
            var oData = {

                // Login details
                currentUser: null,
                isLoggedIn: false,

                // Application navigation
                role: "customer",
                section: "customerHome",

                // Demo users
                users: [
                    {
                        username: "customer",
                        password: "customer123",
                        role: "customer"
                    },
                    {
                        username: "restaurant",
                        password: "restaurant123",
                        role: "restaurant"
                    }
                ],

                // Customer and business counters
                cartCount: 0,
                incomingOrders: 0,
                preparingOrders: 0,
                deliveredOrders: 0,
                menuCount: 0,
                returnCount: 0,

                // Search
                searchText: ""

            };

            var oAppModel = new JSONModel(oData);

            // Set application model globally
            this.setModel(oAppModel, "app");

            // Initialize routing
            this.getRouter().initialize();

        }

    });
});
