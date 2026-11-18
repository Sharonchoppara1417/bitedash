sap.ui.define([], function () {
    "use strict";

    var STORAGE_KEY = "biteDashOrders";

    return {
        readOrders: function () {
            var sSnapshot = "[]";

            try {
                sSnapshot = localStorage.getItem(STORAGE_KEY) || "[]";
                var aOrders = JSON.parse(sSnapshot);

                return {
                    success: true,
                    orders: Array.isArray(aOrders) ? aOrders : [],
                    snapshot: sSnapshot
                };
            } catch (oError) {
                return {
                    success: false,
                    orders: [],
                    snapshot: sSnapshot,
                    error: oError
                };
            }
        },

        saveOrders: function (aOrders) {
            if (!Array.isArray(aOrders)) {
                return false;
            }

            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(aOrders)
                );
                return true;
            } catch (oError) {
                return false;
            }
        }
    };
});
