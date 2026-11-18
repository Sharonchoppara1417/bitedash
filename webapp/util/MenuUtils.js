sap.ui.define([], function () {
    "use strict";

    return {
        getMenuProductKey: function (oProduct) {
            if (
                !oProduct ||
                oProduct.ID === undefined ||
                oProduct.ID === null
            ) {
                return null;
            }

            // ID 0 is a valid product ID
            return String(oProduct.ID);
        }
    };
});
