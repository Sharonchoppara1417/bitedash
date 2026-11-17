sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox
) {
    "use strict";
     var MAX_QTY_PER_ITEM = 10;
    return Controller.extend("bitedash.bitedash.controller.View1", {

// 1. INITIALIZATION

onInit: function () {
    var oView = this.getView();

    // 1. Application and navigation model
    oView.setModel(new JSONModel({
        isLoggedIn: false,
        role: "customer",
        section: "customerHome",
        cartCount: 0,
        incomingOrders: 0,
        preparingOrders: 0,
        deliveredOrders: 0,
        menuCount: 0,
        returnCount: 0,
        searchText: ""
    }), "app");

    // 2. Product menu model
    oView.setModel(new JSONModel({
        items: [],
        loading: true
    }), "products");

    // 3. Shopping cart model
    oView.setModel(new JSONModel({
        items: [],
        count: 0,
        total: 0
    }), "cart");

    // 4. Restaurant orders model
    oView.setModel(new JSONModel({
        items: []
    }), "orderData");

    // 5. Customer My Orders model
    oView.setModel(new JSONModel({
        items: []
    }), "orderedProducts");

    // 6. Selected customer order model
    oView.setModel(new JSONModel({}), "selectedOrderedProduct");

    // 7. Selected restaurant order model
    oView.setModel(new JSONModel({}), "selectedOrder");

    // 8. Checkout model
    oView.setModel(new JSONModel({
        CustomerName: "",
        Phone: "",
        HouseNo: "",
    Street: "",
    Landmark: "",
    City: "",
    State: "",
    Pincode: "",
        Address: "",
        PaymentIndex: 0
    }), "checkout");

    // 9. Customer tracking page model
    oView.setModel(new JSONModel({
        orderId: "",
        status: "",
        customerName: "",
        address: "",
        paymentMode: "",
        lanes: [],
        steps: [],
        items: [],
        bill: {
            subtotal: 0,
            deliveryFee: 0,
            tax: 0,
            total: 0
        }
    }), "trackOrder");

    // 10. Categories model
    oView.setModel(new JSONModel({
        items: []
    }), "categories");

    // 11. Return requests model
    oView.setModel(new JSONModel({
        items: []
    }), "returnData");

    // 12. Return dashboard summary model
    oView.setModel(new JSONModel({
        all: 0,
        open: 0,
        needs: 0,
        awaitingPickup: 0,
        inPickup: 0,
        refunded: 0,
        rejected: 0,
        refundValue: 0
    }), "returnsView");

    // 13. Business dashboard model
    oView.setModel(new JSONModel({
        greeting: "Good evening, Spice Garden",
        ordersToday: 0,
        revenue: "0.0",
        rating: "4.5",
        dishesAvailable: 0,
        alerts: []
    }), "homeView");

    // 14. Load application data after initializing models
    this._loadOrders();
    this._loadProducts();
    this._loadReturns();
    // 15. Keep menu changes synchronized with other BiteDash tabs.
    // The browser fires "storage" in OTHER tabs when menu localStorage changes.
    this._fnMenuStorageSync = function (oEvent) {
        if (
            oEvent.key === "biteDashCustomMenu" ||
            oEvent.key === "biteDashMenuOverrides"
        ) {
            this._syncMenuAcrossTabs();
        }

        // Keep customer order lists and an already-open tracking page in sync
        // when the restaurant updates an order in another browser tab.
        if (oEvent.key === "biteDashOrders") {
            this._loadOrders();
            this._loadReturns();
        }
    }.bind(this);
    window.addEventListener("storage", this._fnMenuStorageSync);

    // Broadcast order changes directly to other BiteDash tabs on this origin.
    // The storage event remains as a fallback for browsers without BroadcastChannel.
    if (typeof window.BroadcastChannel === "function") {
        this._oOrdersChannel = new window.BroadcastChannel("bitedash-orders-sync");
        this._oOrdersChannel.onmessage = function (oMessageEvent) {
            if (
                oMessageEvent.data &&
                oMessageEvent.data.type === "ORDER_UPDATED"
            ) {
                this._loadOrders();
                this._loadReturns();
            }
        }.bind(this);
    }

    // Keep order data synchronized even if the login model is temporarily
    // out of sync. _prepareOrderedProducts applies the correct role/user filter.
    // This is important when the customer is already viewing the tracking page.
    this._sLastOrdersSnapshot = localStorage.getItem("biteDashOrders") || "[]";

    this._fnOrdersVisibilitySync = function () {
        if (document.visibilityState !== "visible") {
            return;
        }

        var sLatestSnapshot = localStorage.getItem("biteDashOrders") || "[]";
        if (sLatestSnapshot !== this._sLastOrdersSnapshot) {
            this._loadOrders();
            this._loadReturns();
        }
    }.bind(this);
    document.addEventListener("visibilitychange", this._fnOrdersVisibilitySync);

    this._iOrdersSyncTimer = window.setInterval(function () {
        var sLatestSnapshot = localStorage.getItem("biteDashOrders") || "[]";
        if (sLatestSnapshot !== this._sLastOrdersSnapshot) {
            this._loadOrders();
            this._loadReturns();
        }
    }.bind(this), 1000);

    // 16. Show the focus box on tab buttons only for Tab/arrow-key navigation
    this._initFocusMode();
},
    _initFocusMode: function () {
        var oRoot = document.documentElement;

        this._fnFocusKeyDown = function (oEvent) {
            var bNavKey = oEvent.key === "Tab" ||
                oEvent.key === "ArrowLeft" ||
                oEvent.key === "ArrowRight";
            var bActivateKey = oEvent.key === "Enter" || oEvent.key === " ";
            var bOnNavButton = oEvent.target && oEvent.target.closest &&
                oEvent.target.closest(".bdNavToolbar");

            if (bNavKey) {
                oRoot.classList.add("bdTabbing");
            } else if (!(bActivateKey && bOnNavButton)) {
                oRoot.classList.remove("bdTabbing");
            }
        };

        this._fnFocusPointer = function () {
            oRoot.classList.remove("bdTabbing");
        };

        document.addEventListener("keydown", this._fnFocusKeyDown, true);
        document.addEventListener("mousedown", this._fnFocusPointer, true);
        document.addEventListener("touchstart", this._fnFocusPointer, true);
    },

    onExit: function () {
        document.removeEventListener("keydown", this._fnFocusKeyDown, true);
        document.removeEventListener("mousedown", this._fnFocusPointer, true);
        document.removeEventListener("touchstart", this._fnFocusPointer, true);
        window.removeEventListener("storage", this._fnMenuStorageSync);
        if (this._oOrdersChannel) {
            this._oOrdersChannel.close();
            this._oOrdersChannel = null;
        }
        document.removeEventListener("visibilitychange", this._fnOrdersVisibilitySync);
        if (this._iOrdersSyncTimer) {
            window.clearInterval(this._iOrdersSyncTimer);
            this._iOrdersSyncTimer = null;
        }
        document.documentElement.classList.remove("bdTabbing");
    },

// 2. DASHBOARD / BUSINESS HOME
    _refreshBusinessHome: function () {
    var oView = this.getView();
    var oHomeModel = oView.getModel("homeView");

    if (!oHomeModel) {
        return;
    }

    var aOrders = oView.getModel("orderData").getProperty("/items") || [];
    var aProducts = oView.getModel("products").getProperty("/items") || [];
    var aReturns = oView.getModel("returnData").getProperty("/items") || [];

    // Get today's date
    var oToday = new Date();

    var sToday = [
        oToday.getFullYear(),
        String(oToday.getMonth() + 1).padStart(2, "0"),
        String(oToday.getDate()).padStart(2, "0")
    ].join("-");

    // Filter today's orders
    var aTodayOrders = aOrders.filter(function (oOrder) {
        var vDate = oOrder.OrderDate || oOrder.CreatedAt;

        if (!vDate || oOrder.Status === "Cancelled") {
            return false;
        }

        var oDate = new Date(vDate);

        if (isNaN(oDate.getTime())) {
            return false;
        }

        var sOrderDate = [
            oDate.getFullYear(),
            String(oDate.getMonth() + 1).padStart(2, "0"),
            String(oDate.getDate()).padStart(2, "0")
        ].join("-");

        return sOrderDate === sToday;
    });

    // Calculate today's revenue
    var fRevenue = aTodayOrders.reduce(function (fTotal, oOrder) {
        return fTotal + (Number(oOrder.Total) || 0);
    }, 0);

    // Prepare attention alerts
    
var aAlerts = [
    {
        title: "2 new orders waiting",
        subtitle: "Accept within 3 minutes",
        buttonText: "Review",
        kind: "orders"
    },
    {
        title: "1 return request",
        subtitle: "Order #4 · Eggs · Damaged",
        buttonText: "Review",
        kind: "returns"
    },
    {
        title: "Butter chicken is switched off",
        subtitle: "Turn it back on to take orders",
        buttonText: "Turn on",
        kind: "dish"
    }
];


    var iPendingOrders = aOrders.filter(function (oOrder) {
        return oOrder.Status !== "Delivered" &&
            oOrder.Status !== "Cancelled";
    }).length;

    var iPendingReturns = aReturns.filter(function (oReturn) {
        return [
            "Requested",
            "Approved",
            "Pickup Scheduled",
            "Picked Up"
        ].indexOf(oReturn.ReturnStatus) !== -1;
    }).length;

    if (iPendingOrders > 0) {
        aAlerts.push({
            title: iPendingOrders + " order(s) need attention",
            subtitle: "Review orders and update their status.",
            buttonText: "View Orders",
            kind: "orders"
        });
    }

    if (iPendingReturns > 0) {
        aAlerts.push({
            title: iPendingReturns + " return request(s) are open",
            subtitle: "Review return requests and refund progress.",
            buttonText: "Review Returns",
            kind: "returns"
        });
    }

    if (aProducts.length === 0) {
        aAlerts.push({
            title: "Your menu is empty",
            subtitle: "Add dishes so customers can discover your menu.",
            buttonText: "Add Dishes",
            kind: "dish"
        });
    }

    // Update Business Home model
    oHomeModel.setData({
        greeting: "Good evening, Spice Garden",
        ordersToday: aTodayOrders.length,
        revenue: fRevenue.toFixed(2),
        rating: oHomeModel.getProperty("/rating") || "4.5",
        dishesAvailable: aProducts.filter(function (oProduct) {
            return oProduct.Available !== false;
        }).length,
        alerts: aAlerts
    });
},
    onHomeAlertPress: function (oEvent) {
    var oContext = oEvent.getSource()
        .getBindingContext("homeView");

    if (!oContext) {
        return;
    }

    var sKind = oContext.getProperty("kind");

    if (sKind === "orders") {
        this.onOpenBusinessOrders();
    } else if (sKind === "returns") {
        this.onOpenBusinessReturns();
    } else if (sKind === "dish") {
        this.onOpenBusinessMenu();
        this.byId("addMenuItemPanel").setExpanded(true);
    }
},
    onOpenBusinessOrders: function () {
            this._loadOrders();

            this.getView().getModel("app")
                .setProperty("/section", "businessOrders");
},
    onOpenBusinessMenu: function () {
            this._loadProducts();

            this.getView().getModel("app")
                .setProperty("/section", "businessMenu");
},
    onOpenBusinessReturns: function () {
    this._loadReturns();

    this.getView().getModel("app")
        .setProperty("/section", "businessReturns");
},

//3. DATA LOADING
    _loadProducts: function () {
    var oView = this.getView();
    var oODataModel = this.getOwnerComponent().getModel();
    var oProductsModel = oView.getModel("products");
    var oAppModel = oView.getModel("app");
    var oCategoriesModel = oView.getModel("categories");
    var that = this;

    if (oProductsModel) {
        oProductsModel.setProperty("/loading", true);
    }

    if (!oCategoriesModel) {
        oCategoriesModel = new sap.ui.model.json.JSONModel({ items: [] });
        oView.setModel(oCategoriesModel, "categories");
    }

    function readLocalArray(sKey) {
        try {
            var vData = JSON.parse(localStorage.getItem(sKey) || "[]");
            return Array.isArray(vData) ? vData : [];
        } catch (e) {
            console.error("Could not read " + sKey + ":", e);
            return [];
        }
    }

    function publishProducts(aODataProducts) {
        var aCustomItems = readLocalArray("biteDashCustomMenu");
        var aOverrides = readLocalArray("biteDashMenuOverrides");

        // Apply saved edits to OData products and default availability to ON.
        var aBaseProducts = (aODataProducts || []).map(function (oProduct) {
            var oCopy = Object.assign({
                Available: true,
                Category: "",
                CategoryNames: ""
            }, oProduct);

            var oOverride = aOverrides.find(function (oItem) {
                return String(oItem.ID) === String(oCopy.ID);
            });

            return oOverride ? Object.assign(oCopy, oOverride) : oCopy;
        });

        aCustomItems = aCustomItems.map(function (oItem) {
            return Object.assign({
                Available: true,
                Category: "Food",
                CategoryNames: "Food"
            }, oItem);
        });

        // Do not remove unavailable products here. Restaurant must be able
        // to switch them ON again; customer list filters them separately.
        var aCombined = aBaseProducts.concat(aCustomItems);

        if (oProductsModel) {
            oProductsModel.setProperty("/items", aCombined);
            oProductsModel.setProperty("/loading", false);
            oProductsModel.refresh(true);
        }

        if (oAppModel) {
            oAppModel.setProperty("/menuCount", aCombined.length);
        }

        that._prepareOrderedProducts();
        that._refreshBusinessHome();

        var oSearch = oView.byId("foodSearchField");
        if (oView.byId("foodMenuList")) {
            that._applyFoodFilters(oSearch ? oSearch.getValue() : "");
        }

        console.log("BiteDash products published:", {
            oDataCount: (aODataProducts || []).length,
            customCount: aCustomItems.length,
            totalCount: aCombined.length
        });
    }

    if (!oODataModel || typeof oODataModel.read !== "function") {
        publishProducts([]);
        MessageBox.error("OData model is missing. Check the mainService configuration in manifest.json.");
        return;
    }

    // Categories are supplementary. A category endpoint error must never
    // prevent the main Products entity set from loading.
    oODataModel.read("/Categories", {
        success: function (oCategoryData) {
            oCategoriesModel.setProperty("/items", oCategoryData.results || []);
        },
        error: function (oError) {
            console.warn("Categories could not be loaded; loading products independently.", oError);
        }
    });

    // Try the expanded response first to retain category names.
    // Some OData V3 hosts reject $expand, so fall back to plain /Products.
    oODataModel.read("/Products", {
        urlParameters: {
            "$expand": "Categories"
        },
        success: function (oProductData) {
            var aProducts = oProductData.results || [];

            aProducts.forEach(function (oProduct) {
                var vCategories = oProduct.Categories;
                var aProductCategories = [];

                if (vCategories) {
                    aProductCategories = Array.isArray(vCategories.results)
                        ? vCategories.results
                        : (Array.isArray(vCategories) ? vCategories : []);
                }

                var aNames = aProductCategories.map(function (oCategory) {
                    return oCategory.Name;
                }).filter(Boolean);

                oProduct.CategoryNames = aNames.join(" ");
                oProduct.Category = aNames[0] || "";
            });

            publishProducts(aProducts);
            MessageToast.show(aProducts.length + " OData products loaded.");
        },
        error: function (oExpandError) {
            console.warn("Products with category expansion failed. Retrying plain Products request.", oExpandError);

            oODataModel.read("/Products", {
                success: function (oProductData) {
                    var aProducts = oProductData.results || [];

                    aProducts.forEach(function (oProduct) {
                        oProduct.Category = oProduct.Category || "";
                        oProduct.CategoryNames = oProduct.CategoryNames || "";
                    });

                    publishProducts(aProducts);
                    MessageToast.show(
                        aProducts.length + " OData products loaded (without category expansion)."
                    );
                },
                error: function (oProductError) {
                    console.error("OData Products request failed:", oProductError);
                    publishProducts([]);

                    var sStatus = oProductError && oProductError.statusCode
                        ? " (HTTP " + oProductError.statusCode + ")"
                        : "";

                    MessageBox.error(
                        "OData Products could not be loaded" + sStatus +
                        ". Check the /V3/OData/OData.svc/Products request in the browser Network tab."
                    );
                }
            });
        }
    });
},
    // Update an already-open customer/restaurant tab when another tab changes the menu.
    // This avoids forcing customers to refresh or log in again.
    _syncMenuAcrossTabs: function () {
        var oView = this.getView();
        var oProductsModel = oView.getModel("products");

        if (!oProductsModel) {
            return;
        }

        function readMenuArray(sKey) {
            try {
                var aData = JSON.parse(localStorage.getItem(sKey) || "[]");
                return Array.isArray(aData) ? aData : [];
            } catch (e) {
                console.error("Could not synchronize " + sKey + ":", e);
                return [];
            }
        }

        var aCustomItems = readMenuArray("biteDashCustomMenu");
        var aOverrides = readMenuArray("biteDashMenuOverrides");
        var aItems = (oProductsModel.getProperty("/items") || []).map(function (oItem) {
            var oCustom = aCustomItems.find(function (oSaved) {
                return String(oSaved.ID) === String(oItem.ID);
            });
            var oOverride = aOverrides.find(function (oSaved) {
                return String(oSaved.ID) === String(oItem.ID);
            });

            return Object.assign(
                {},
                oItem,
                oCustom || {},
                oOverride || {}
            );
        });

        // Include newly added restaurant items in the already-open customer tab.
        aCustomItems.forEach(function (oCustom) {
            var bExists = aItems.some(function (oItem) {
                return String(oItem.ID) === String(oCustom.ID);
            });

            if (!bExists) {
                aItems.push(Object.assign({
                    Available: true,
                    Category: "Food",
                    CategoryNames: "Food"
                }, oCustom));
            }
        });

        oProductsModel.setProperty("/items", aItems);
        oProductsModel.refresh(true);

        var oSearch = oView.byId("foodSearchField");
        if (oView.byId("foodMenuList")) {
            this._applyFoodFilters(oSearch ? oSearch.getValue() : "");
        }

        this._refreshBusinessHome();
        console.log("BiteDash menu synchronized from another browser tab.");
    },

    _broadcastOrderUpdate: function (oOrder) {
    // Notify other open tabs immediately after the order is saved.
    if (this._oOrdersChannel && oOrder && oOrder.OrderID != null) {
        this._oOrdersChannel.postMessage({
            type: "ORDER_UPDATED",
            orderId: String(oOrder.OrderID),
            status: oOrder.Status
        });
    }
},

_loadOrders: function () {
    var aOrders = [];
    var sOrdersSnapshot = localStorage.getItem("biteDashOrders") || "[]";
    this._sLastOrdersSnapshot = sOrdersSnapshot;

    try {
        aOrders = JSON.parse(sOrdersSnapshot);

        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }
    } catch (e) {
        MessageToast.show("Could not read saved orders.");
        console.error("Order loading failed:", e);
        aOrders = [];
    }

    aOrders.forEach(function (oOrder) {
        oOrder.Items = Array.isArray(oOrder.Items)
            ? oOrder.Items
            : [];

        oOrder.ItemSummary = oOrder.Items.map(function (oItem) {
            return (oItem.Name || "Product") +
                " × " + (Number(oItem.Quantity) || 1);
        }).join(", ");

        oOrder.Total = Number(oOrder.Total) || 0;
    });

    // Store complete orders
    this.getView()
        .getModel("orderData")
        .setProperty("/items", aOrders);

    // Update dashboard counts
    var iIncomingOrders = aOrders.filter(function (oOrder) {
        return oOrder.Status !== "Delivered" &&
            oOrder.Status !== "Cancelled";
    }).length;

    var iPreparingOrders = aOrders.filter(function (oOrder) {
        return oOrder.Status === "Preparing";
    }).length;

    var iDeliveredOrders = aOrders.filter(function (oOrder) {
        return oOrder.Status === "Delivered";
    }).length;

    var oAppModel = this.getView().getModel("app");

    oAppModel.setProperty("/incomingOrders", iIncomingOrders);
    oAppModel.setProperty("/preparingOrders", iPreparingOrders);
    oAppModel.setProperty("/deliveredOrders", iDeliveredOrders);

    // Prepare customer My Orders list
    this._prepareOrderedProducts();

    this._refreshBusinessHome();
},


_loadReturns: function () {

    var oView = this.getView();
    var aOrders = [];

    // 1. Read saved orders from localStorage
    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );

        // Make sure the saved data is an array
        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }

    } catch (e) {
        sap.m.MessageToast.show("Could not load return requests.");
        aOrders = [];
    }

    // 2. Extract return requests for the current role.
    // Customers only see their own returns; the restaurant sees all requests.
    var oAppModel = oView.getModel("app");
    var sCurrentRole = oAppModel.getProperty("/role");
    var sCurrentUser = oAppModel.getProperty("/currentUser");

    var aReturns = aOrders
        .filter(function (oOrder) {
            if (!oOrder.ReturnStatus) {
                return false;
            }

            if (sCurrentRole === "business") {
                return true;
            }

            // Older demo orders without a username remain visible only
            // to the original demo customer account.
            return oOrder.CustomerUsername
                ? oOrder.CustomerUsername === sCurrentUser
                : sCurrentUser === "customer";
        })
        .map(function (oOrder) {

            var aItems = Array.isArray(oOrder.Items)
                ? oOrder.Items
                : [];

            var fRefundAmount = Number(
                oOrder.RefundAmount != null
                    ? oOrder.RefundAmount
                    : oOrder.Total || 0
            );

            return Object.assign({}, oOrder, {

                ItemSummary: oOrder.ItemSummary ||
                    aItems.map(function (oItem) {
                        return (oItem.Name || "Item") +
                            " × " + (oItem.Quantity || 1);
                    }).join(", "),

                RefundAmount: isNaN(fRefundAmount)
                    ? 0
                    : fRefundAmount,

                expanded: false

            });

        });

    // 3. Preserve the complete original returns list
    // Search and status filters must always use this array
    this._aAllReturns = aReturns;

    // 4. Calculate summary counts
    var iOpen = 0;
    var iNeeds = 0;
    var iAwaitingPickup = 0;
    var iInPickup = 0;
    var iRefunded = 0;
    var iRejected = 0;
    var fRefundValue = 0;

    aReturns.forEach(function (oReturn) {

        var sStatus = oReturn.ReturnStatus;

        if (sStatus !== "Rejected" && sStatus !== "Refunded") {
            iOpen++;
        }

        if (sStatus === "Requested") {
            iNeeds++;
        }

        if (sStatus === "Approved") {
            iAwaitingPickup++;
        }

        if (
            sStatus === "Pickup Scheduled" ||
            sStatus === "Picked Up"
        ) {
            iInPickup++;
        }

        if (sStatus === "Refunded") {
            iRefunded++;
            fRefundValue += oReturn.RefundAmount;
        }

        if (sStatus === "Rejected") {
            iRejected++;
        }

    });

    // 5. Update summary tiles and filter counts
    oView.getModel("returnsView").setData({

        all: aReturns.length,
        open: iOpen,
        needs: iNeeds,
        awaitingPickup: iAwaitingPickup,
        inPickup: iInPickup,
        refunded: iRefunded,
        rejected: iRejected,
        refundValue: fRefundValue.toFixed(2)

    });

    // 6. Update application return count
    oView.getModel("app").setProperty(
        "/returnCount",
        iOpen
    );

    // 7. Apply current search and selected status filter
    this._applyReturnFilters();

    // 8. Refresh restaurant dashboard
    this._refreshBusinessHome();

},



// 4. ROLE SWITCHING AND NAVIGATION
    onRoleChange: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sRole;

            // Support the SegmentedButton selection event
            if (oItem && oItem.getKey) {
                sRole = oItem.getKey();
            } else {
                sRole = oEvent.getParameter("key");
            }

            if (!sRole) {
                return;
            }

            var oAppModel = this.getView().getModel("app");

            oAppModel.setProperty("/role", sRole);

       
            
if (sRole === "business") {
    oAppModel.setProperty("/section", "businessHome");

    this._loadOrders();
    this._loadProducts();
    this._loadReturns();

    MessageToast.show("Restaurant mode opened");
}
 else {
                oAppModel.setProperty("/section", "customerHome");
                this._loadProducts();
                MessageToast.show("Customer mode opened");
            }
},
    onNavigate: function (oEvent) {
    var oSource = oEvent.getSource();
    var sSection = oSource.data("section");
    var oAppModel = this.getView().getModel("app");

    if (!sSection) {
        console.warn("Navigation section is missing.");
        return;
    }

    console.log("Navigation requested:", sSection);

    oAppModel.setProperty("/section", sSection);

    if (sSection === "customerOrders" ||
        sSection === "businessOrders") {
        this._loadOrders();
    }

    if (sSection === "customerMenu" ||
        sSection === "businessMenu") {
        this._loadProducts();
    }

    if (sSection === "businessReturns" ||
        sSection === "customerReturns") {
        this._loadReturns();
    }

    console.log(
        "Current section:",
        oAppModel.getProperty("/section")
    );
},
   onCustomerHome: function () {
    var oAppModel = this.getView().getModel("app");

    oAppModel.setProperty("/role", "customer");
    oAppModel.setProperty("/section", "customerHome");
},

    onOpenMenu: function () {
    var oView = this.getView();
    var oAppModel = oView.getModel("app");

    // Set customer role
    oAppModel.setProperty("/role", "customer");

    // Navigate to Menu
    oAppModel.setProperty("/section", "customerMenu");

    console.log("Before loading products:",
        oAppModel.getProperty("/section"));

    // Load menu products
    this._loadProducts();

    console.log("After loading products:",
        oAppModel.getProperty("/section"));
},
    onOpenCart: function () {
    var oAppModel = this.getView().getModel("app");

    oAppModel.setProperty("/role", "customer");
    oAppModel.setProperty("/section", "customerCart");
},
    onRestaurantOrders: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessOrders");

},
    onRestaurantMenu: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessMenu");

},

//5. CUSTOMER SEARCH
    onHomeSearchLiveChange: function (oEvent) {

    var sQuery = oEvent.getParameter("newValue") || "";

    this.getView().getModel("app").setProperty(
        "/searchText",
        sQuery
    );

},

    onHomeSearchSubmit: function (oEvent) {

    var sQuery = oEvent.getParameter("query") || "";

    sQuery = sQuery.trim();

    this.getView().getModel("app").setProperty(
        "/searchText",
        sQuery
    );

    // Navigate to menu
    this.getView().getModel("app").setProperty(
        "/section",
        "customerMenu"
    );

    // Synchronize menu search field
    var oMenuSearch = this.byId("foodSearchField");

    if (oMenuSearch) {
        oMenuSearch.setValue(sQuery);
    }

    // Apply product filters
    this._applyFoodFilters(sQuery);

},

//6. CUSTOMER MENU
    onSearch: function (oEvent) {

    var sQuery = oEvent.getParameter("newValue");

    if (sQuery === undefined) {
        sQuery = oEvent.getParameter("query") || "";
    }

    sQuery = sQuery.trim();

    this.getView().getModel("app").setProperty(
        "/searchText",
        sQuery
    );

    this._applyFoodFilters(sQuery);

},
    onFoodSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");

            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("query") || "";
            }

            this.getView().getModel("app")
                .setProperty("/searchText", sQuery);

            this._applyFoodFilters(sQuery);
},
    onFoodCategoryChange: function () {
    var oSearch = this.byId("foodSearchField");

    this._applyFoodFilters(
        oSearch ? oSearch.getValue() : ""
    );
},
    onMenuCategoryButton: function (oEvent) {

    var sCategory = oEvent.getSource().data("category") || "All";

    this._sMenuCategory = sCategory;

    var oTable = this.byId("foodMenuList");

    if (oTable) {
        oTable.removeSelections(true);
    }

    this._oSelectedMenuProduct = null;

    this.getView().getModel("app").setProperty(
        "/canAddSelectedProduct",
        false
    );

    // Reapply search and category filters together
    this._applyFoodFilters();

},
   




onMenuProductSelect: function (oEvent) {
    var oTable = oEvent.getSource();
    var oApp = this.getView().getModel("app");

    if (!this._aSelectedMenuProducts) {
        this._aSelectedMenuProducts = [];
    }

    var bSelectAll = oEvent.getParameter("selectAll");
    var bSelected = oEvent.getParameter("selected");

    // HEADER CHECKBOX
    if (bSelectAll) {

        if (typeof bSelected !== "boolean") {
            bSelected = oTable.getSelectedItems().length > 0;
        }

        var oBinding = oTable.getBinding("items");

        if (!oBinding) {
            return;
        }

        // Get the complete filtered result, not only loaded rows
        var iLength = oBinding.getLength();
        var aContexts = oBinding.getContexts(0, iLength);

        if (bSelected) {

            // Select every product in the active category/search
            aContexts.forEach(function (oContext) {

                if (!oContext) {
                    return;
                }

                var oProduct = oContext.getObject();
                var sKey = this._getMenuProductKey(oProduct);

                if (sKey === null) {
                    return;
                }

                var bAlreadySelected =
                    this._aSelectedMenuProducts.some(function (oItem) {
                        return this._getMenuProductKey(oItem) === sKey;
                    }.bind(this));

                if (!bAlreadySelected) {
                    this._aSelectedMenuProducts.push(
                        Object.assign({}, oProduct)
                    );
                }

            }.bind(this));

        } else {

            // Deselect only products belonging to the current filter
            var aCurrentKeys = aContexts.map(function (oContext) {
                return oContext
                    ? this._getMenuProductKey(oContext.getObject())
                    : null;
            }.bind(this));

            this._aSelectedMenuProducts =
                this._aSelectedMenuProducts.filter(function (oItem) {
                    return aCurrentKeys.indexOf(
                        this._getMenuProductKey(oItem)
                    ) === -1;
                }.bind(this));
        }

    } else {

        // INDIVIDUAL ROW CHECKBOX
        var oRow = oEvent.getParameter("listItem");

        if (oRow) {

            var oContext = oRow.getBindingContext("products");

            if (!oContext) {
                return;
            }

            var oProduct = oContext.getObject();
            var sProductKey = this._getMenuProductKey(oProduct);

            if (sProductKey === null) {
                return;
            }

            var iIndex =
                this._aSelectedMenuProducts.findIndex(function (oItem) {
                    return this._getMenuProductKey(oItem) === sProductKey;
                }.bind(this));

            if (bSelected) {

                if (iIndex === -1) {
                    this._aSelectedMenuProducts.push(
                        Object.assign({}, oProduct)
                    );
                }

            } else {

                if (iIndex !== -1) {
                    this._aSelectedMenuProducts.splice(iIndex, 1);
                }
            }
        }
    }

    // Enable or disable Add to Cart
    oApp.setProperty(
        "/canAddSelectedProduct",
        this._aSelectedMenuProducts.length > 0
    );
},



    _applyFoodFilters: function (sSearch) {

    var oTable = this.byId("foodMenuList");

    if (!oTable) {
        return;
    }

    var oBinding = oTable.getBinding("items");

    if (!oBinding) {
        return;
    }

    var Filter = sap.ui.model.Filter;
    var FilterOperator = sap.ui.model.FilterOperator;

    var aFilters = [];

    // STEP 1: Get search text
    if (sSearch === undefined || sSearch === null) {

        sSearch = this.getView()
            .getModel("app")
            .getProperty("/searchText") || "";

    }

    sSearch = sSearch.trim();

    // STEP 2: Search by product name or description
    if (sSearch) {

        aFilters.push(new Filter({
            filters: [
                new Filter(
                    "Name",
                    FilterOperator.Contains,
                    sSearch
                ),
                new Filter(
                    "Description",
                    FilterOperator.Contains,
                    sSearch
                )
            ],
            and: false
        }));

    }

    // STEP 3: Apply category filter
    var sCategory = this._sMenuCategory || "All";

    if (sCategory !== "All") {

        aFilters.push(new Filter({
            filters: [
                new Filter(
                    "Category",
                    FilterOperator.EQ,
                    sCategory
                ),
                new Filter(
                    "CategoryNames",
                    FilterOperator.Contains,
                    sCategory
                )
            ],
            and: false
        }));

    }

    // STEP 4: Do not filter by availability. Customers should see every
    // OData product and every manually added item, including unavailable
    // products, with the status displayed in green or red in the table.
    oBinding.filter(aFilters);

},

//7. CART MANAGEMENT









onAddSelectedProductToCart: function () {
    var oView = this.getView();
    var oTable = this.byId("foodMenuList");
    var oCart = oView.getModel("cart");
    var oApp = oView.getModel("app");

    if (!oCart) {
        sap.m.MessageBox.error("Cart model not found.");
        return;
    }

    var aSelectedProducts = this._aSelectedMenuProducts || [];

    if (aSelectedProducts.length === 0) {
        sap.m.MessageToast.show(
            "Please select at least one product."
        );
        return;
    }

    var aCartItems = (oCart.getProperty("/items") || []).map(
        function (oItem) {
            return Object.assign({}, oItem);
        }
    );

    var iAdded = 0;

    aSelectedProducts.forEach(function (oProduct) {

        var sKey = this._getMenuProductKey(oProduct);

        if (sKey === null) {
            return;
        }

        var iIndex = aCartItems.findIndex(function (oItem) {
            return this._getMenuProductKey(oItem) === sKey;
        }.bind(this));

        if (iIndex !== -1) {

            // Same product: increase quantity and include it in the next order.
            aCartItems[iIndex].Quantity =
                (Number(aCartItems[iIndex].Quantity) || 0) + 1;
            aCartItems[iIndex].Selected = true;

        } else {

            // Different product: add a separate cart item
            var oNewItem = Object.assign({}, oProduct);
            oNewItem.Quantity = 1;
            oNewItem.Selected = true;

            aCartItems.push(oNewItem);
        }

        iAdded++;

    }.bind(this));

    if (iAdded === 0) {
        sap.m.MessageToast.show("No valid products selected.");
        return;
    }

    // Update cart and totals
    this._updateCartTotals(aCartItems);

    // Clear all selections
    if (oTable) {
        oTable.removeSelections(true);
    }

    this._aSelectedMenuProducts = [];

    oApp.setProperty("/canAddSelectedProduct", false);

    sap.m.MessageToast.show(
        iAdded + " products added to your cart."
    );
},



_getMenuProductKey: function (oProduct) {
    if (
        !oProduct ||
        oProduct.ID === undefined ||
        oProduct.ID === null
    ) {
        return null;
    }

    // ID 0 is a valid product ID
    return String(oProduct.ID);
},

onIncreaseCartItem: function (oEvent) {
    this._changeCartQuantity(oEvent, 1);
},

onDecreaseCartItem: function (oEvent) {
    this._changeCartQuantity(oEvent, -1);
},

_changeCartQuantity: function (oEvent, iChange) {
    var oView = this.getView();
    var oCart = oView.getModel("cart");
    var oContext = oEvent.getSource().getBindingContext("cart");

    if (!oCart || !oContext) {
        sap.m.MessageToast.show("Cart item not found.");
        return;
    }

    // Get the exact array position of the clicked cart item
    var sPath = oContext.getPath();
    var aPathParts = sPath.split("/");
    var iIndex = Number(aPathParts[aPathParts.length - 1]);

    var aItems = oCart.getProperty("/items") || [];

    if (
        aPathParts.length < 3 ||
        aPathParts[aPathParts.length - 2] !== "items" ||
        !Number.isInteger(iIndex) ||
        iIndex < 0 ||
        iIndex >= aItems.length
    ) {
        sap.m.MessageToast.show("Invalid cart item.");
        return;
    }

    // Create a new array to update the JSONModel
    aItems = aItems.map(function (oItem) {
        return Object.assign({}, oItem);
    });

    var iCurrentQuantity = Number(aItems[iIndex].Quantity) || 1;
    var iNewQuantity = iCurrentQuantity + iChange;
if (iNewQuantity > MAX_QTY_PER_ITEM) {
    sap.m.MessageToast.show("Maximum " + MAX_QTY_PER_ITEM + " per item.");
    return;
}
    // Remove item if quantity becomes zero
    if (iNewQuantity <= 0) {
        var sRemovedName = aItems[iIndex].Name || "Item";
        aItems.splice(iIndex, 1);

        this._updateCartTotals(aItems);

        sap.m.MessageToast.show(sRemovedName + " removed from cart.");
        return;
    }

    // Update only the clicked product quantity
    aItems[iIndex].Quantity = iNewQuantity;

    this._updateCartTotals(aItems);
},

onRemoveCartItem: function (oEvent) {
    var oView = this.getView();
    var oCart = oView.getModel("cart");
    var oContext = oEvent.getSource().getBindingContext("cart");

    if (!oCart || !oContext) {
        sap.m.MessageToast.show("Cart item not found.");
        return;
    }

    // Get the exact cart row index
    var sPath = oContext.getPath();
    var aPathParts = sPath.split("/");
    var iIndex = Number(aPathParts[aPathParts.length - 1]);

    var aItems = oCart.getProperty("/items") || [];

    if (
        aPathParts.length < 3 ||
        aPathParts[aPathParts.length - 2] !== "items" ||
        !Number.isInteger(iIndex) ||
        iIndex < 0 ||
        iIndex >= aItems.length
    ) {
        sap.m.MessageToast.show("Invalid cart item.");
        return;
    }

    var sRemovedName = aItems[iIndex].Name || "Item";

    // Create a separate array and remove only the selected row
    aItems = aItems.map(function (oItem) {
        return Object.assign({}, oItem);
    });

    aItems.splice(iIndex, 1);

    this._updateCartTotals(aItems);

    sap.m.MessageToast.show(sRemovedName + " removed from cart.");
},

_updateCartTotals: function (aItems) {
    var oView = this.getView();
    var oCart = oView.getModel("cart");
    var oApp = oView.getModel("app");

    if (!oCart) {
        sap.m.MessageBox.error("Cart model not found.");
        return;
    }

    var iCount = 0;
    var fTotal = 0;
    var iSelectedCount = 0;
    var fSelectedTotal = 0;

    aItems.forEach(function (oItem) {
        var iQuantity = Math.max(
            1,
            Number(oItem.Quantity) || 1
        );

        var fPrice = Math.max(
            0,
            Number(oItem.Price) || 0
        );

        oItem.Quantity = iQuantity;

        // New cart items are included in the next order by default.
        if (typeof oItem.Selected === "undefined") {
            oItem.Selected = true;
        }

        iCount += iQuantity;
        fTotal += fPrice * iQuantity;

        if (oItem.Selected !== false) {
            iSelectedCount += iQuantity;
            fSelectedTotal += fPrice * iQuantity;
        }
    });

    // Keep full-cart totals separate from the current order selection.
    oCart.setProperty("/items", aItems);
    oCart.setProperty("/count", iCount);
    oCart.setProperty("/total", Number(fTotal.toFixed(2)));
    oCart.setProperty("/selectedCount", iSelectedCount);
    oCart.setProperty("/selectedTotal", Number(fSelectedTotal.toFixed(2)));

    // Update application cart counter
    if (oApp) {
        oApp.setProperty("/cartCount", iCount);
    }
},

    onProceedToCheckout: function () {
    var oView = this.getView();
    var oCart = oView.getModel("cart");
    var oApp = oView.getModel("app");

    if (!oCart || !oApp) {
        sap.m.MessageBox.error(
            "The cart or application model is missing."
        );
        return;
    }

    var aItems = oCart.getProperty("/items") || [];

    if (aItems.length === 0) {
        sap.m.MessageToast.show("Please add items to your cart first.");
        return;
    }

    // Keep the full cart totals and selected-item totals synchronized.
    this._updateCartTotals(aItems);

    var aSelectedItems = aItems.filter(function (oItem) {
        return oItem.Selected !== false;
    });

    if (!aSelectedItems.length) {
        sap.m.MessageToast.show(
            "Select at least one product for this order."
        );
        return;
    }

    // Checkout contains only the products selected for this order.
    oCart.setProperty("/checkoutItems", aSelectedItems.map(function (oItem) {
        return Object.assign({}, oItem);
    }));
    oCart.setProperty("/checkoutCount", Number(oCart.getProperty("/selectedCount")) || 0);
    oCart.setProperty("/checkoutTotal", Number(oCart.getProperty("/selectedTotal")) || 0);

    oApp.setProperty("/section", "checkout");
},
    onCartItemSelectionChange: function () {
    var oCart = this.getView().getModel("cart");

    if (oCart) {
        this._updateCartTotals(oCart.getProperty("/items") || []);
    }
},
    onBackToCart: function () {
    var oApp = this.getView().getModel("app");

    if (oApp) {
        oApp.setProperty("/section", "customerCart");
    }
},

//8. CHECKOUT & ORDER SECTION
    onPlaceOrder: function () {
    var oView = this.getView();
    var oCheckout = oView.getModel("checkout");
    var oCart = oView.getModel("cart");
    var oApp = oView.getModel("app");

    // Prevent a rapid double click from creating duplicate orders.
    if (this._bOrderSubmissionInProgress) {
        MessageToast.show("Your order is already being processed.");
        return;
    }

    if (!oCheckout || !oCart || !oApp) {
        MessageBox.error("Checkout information is unavailable. Please try again.");
        return;
    }

    var oDetails = oCheckout.getData() || {};
    var aAllCartItems = oCart.getProperty("/items") || [];
    var aCartItems = oCart.getProperty("/checkoutItems") || [];

    if (!aAllCartItems.length) {
        MessageToast.show("Your cart is empty.");
        oApp.setProperty("/section", "customerMenu");
        return;
    }

    if (!aCartItems.length) {
        MessageToast.show("Please select products for this order from your cart.");
        oApp.setProperty("/section", "customerCart");
        return;
    }

    if (!oDetails.CustomerName || !oDetails.CustomerName.trim()) {
        MessageToast.show("Please enter your name.");
        return;
    }

    if (!/^[0-9]{10}$/.test(oDetails.Phone || "")) {
        MessageToast.show("Enter a valid 10-digit mobile number.");
        return;
    }

    if (!oDetails.HouseNo || !oDetails.HouseNo.trim()) {
        MessageToast.show("Please enter House/Flat number.");
        return;
    }

    if (!oDetails.Street || !oDetails.Street.trim()) {
        MessageToast.show("Please enter Street/Area.");
        return;
    }

    if (!oDetails.City || !oDetails.City.trim()) {
        MessageToast.show("Please enter City.");
        return;
    }

    if (!oDetails.State || !oDetails.State.trim()) {
        MessageToast.show("Please enter State.");
        return;
    }

    if (!/^[0-9]{6}$/.test(oDetails.Pincode || "")) {
        MessageToast.show("Enter a valid 6-digit PIN code.");
        return;
    }

    // Snapshot only the selected cart lines into ONE order.
    var aOrderItems = aCartItems.map(function (oItem) {
        return {
            ID: oItem.ID,
            Name: oItem.Name,
            Description: oItem.Description || "",
            Rating: Number(oItem.Rating) || 0,
            Price: Number(oItem.Price) || 0,
            Quantity: Math.max(1, Number(oItem.Quantity) || 1)
        };
    });

    var iTotalQuantity = aOrderItems.reduce(function (iTotal, oItem) {
        return iTotal + oItem.Quantity;
    }, 0);

    var fTotal = aOrderItems.reduce(function (fSum, oItem) {
        return fSum + (oItem.Price * oItem.Quantity);
    }, 0);

    this._bOrderSubmissionInProgress = true;

    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );

        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }
    } catch (e) {
        this._bOrderSubmissionInProgress = false;
        MessageBox.error("Unable to read saved orders.");
        return;
    }

    var iNextId = aOrders.reduce(function (iMax, oOrder) {
        return Math.max(iMax, Number(oOrder.OrderID) || 0);
    }, 0) + 1;

    var aPaymentMethods = [
        "Cash on Delivery",
        "UPI (demo)",
        "Card (demo)"
    ];

    // Exactly ONE order record, containing only the selected products.
    var oOrder = {
        OrderID: iNextId,
        CustomerUsername: oApp.getProperty("/currentUser") || "customer",
        CustomerName: oDetails.CustomerName.trim(),
        Phone: oDetails.Phone,
        Address:
            oDetails.HouseNo + ", " +
            oDetails.Street + ", " +
            (oDetails.Landmark ? oDetails.Landmark + ", " : "") +
            oDetails.City + ", " +
            oDetails.State + " - " +
            oDetails.Pincode,
        PaymentMethod:
            aPaymentMethods[oDetails.PaymentIndex] || "Cash on Delivery",
        Items: aOrderItems,
        ItemCount: iTotalQuantity,
        Total: Number(fTotal.toFixed(2)),
        OrderDate: new Date().toISOString(),
        Status: "Placed"
    };

    // Append once and save the single combined order.
    aOrders.push(oOrder);

    try {
        localStorage.setItem(
            "biteDashOrders",
            JSON.stringify(aOrders)
        );
    } catch (e) {
        this._bOrderSubmissionInProgress = false;
        MessageBox.error(
            "The order could not be saved in browser storage."
        );
        return;
    }

    // Refresh customer and restaurant order views from the same saved order.
    this._loadOrders();

    // Remove only the products included in this order.
    // Unselected products remain in the cart for the customer's next order.
    var oOrderedIds = {};
    aOrderItems.forEach(function (oItem) {
        oOrderedIds[String(oItem.ID)] = true;
    });

    var aRemainingCartItems = aAllCartItems.filter(function (oItem) {
        return !oOrderedIds[String(oItem.ID)];
    });

    this._updateCartTotals(aRemainingCartItems);
    oCart.setProperty("/checkoutItems", []);
    oCart.setProperty("/checkoutCount", 0);
    oCart.setProperty("/checkoutTotal", 0);

    oCheckout.setData({
        CustomerName: "",
        Phone: "",
        HouseNo: "",
        Street: "",
        Landmark: "",
        City: "",
        State: "",
        Pincode: "",
        PaymentIndex: 0
    });

    this._bOrderSubmissionInProgress = false;

    MessageBox.success(
        "Your order containing " + iTotalQuantity +
        " item(s) has been placed successfully! Order ID: " +
        oOrder.OrderID,
        {
            title: "Order Confirmed",
            onClose: function () {
                oApp.setProperty("/section", "customerOrders");
            }
        }
    );
},

//9.CUSTOMER ORDERS
    _prepareOrderedProducts: function () {
    var oView = this.getView();

    var oOrdersModel = oView.getModel("orderData");
    var aOrders = oOrdersModel.getProperty("/items") || [];

    var oAppModel = oView.getModel("app");
    var sCurrentUser = oAppModel
        ? oAppModel.getProperty("/currentUser")
        : null;
    var sCurrentRole = oAppModel
        ? oAppModel.getProperty("/role")
        : "customer";

    // Customers see only their own orders. The restaurant keeps access to
    // the complete order list. Older demo orders without an owner remain
    // visible to the original shared "customer" demo account.
    var aVisibleOrders = sCurrentRole === "business"
        ? aOrders
        : aOrders.filter(function (oOrder) {
            return oOrder.CustomerUsername
                ? oOrder.CustomerUsername === sCurrentUser
                : sCurrentUser === "customer";
        });

    var aOrderedProducts = aVisibleOrders.map(function (oOrder) {

        var aItems = (oOrder.Items || []).map(function (oItem) {
            return {
                ID: oItem.ID,
                Name: oItem.Name || "Product",
                Description: oItem.Description || "",
                Rating: Number(oItem.Rating) || 0,
                Price: Number(oItem.Price) || 0,
                Quantity: Number(oItem.Quantity) || 1
            };
        });

        var nTotal = aItems.reduce(function (nSum, oItem) {
            return nSum + (oItem.Price * oItem.Quantity);
        }, 0);

        return {
            OrderID: oOrder.OrderID,
            OrderDate: oOrder.OrderDate,
            CustomerName: oOrder.CustomerName,
            CustomerUsername: oOrder.CustomerUsername || "customer",
            Phone: oOrder.Phone,
            Address: oOrder.Address,
            PaymentMethod: oOrder.PaymentMethod,
            Status: oOrder.Status,
            ReturnStatus: oOrder.ReturnStatus || "",
            Items: aItems,
            ItemSummary: aItems.map(function (oItem) {
                return oItem.Name + " × " + oItem.Quantity;
            }).join(", "),
            Total: Number(oOrder.Total) || nTotal
        };
    });

    // Update the model used by the My Orders XML
    oView.getModel("orderedProducts").setProperty(
        "/items",
        aOrderedProducts
    );

    // Preserve the selected order if it still exists
    var oSelectedModel = oView.getModel("selectedOrderedProduct");
    var oSelected = oSelectedModel.getData();

    if (oSelected && oSelected.OrderID) {
        var oUpdated = aOrderedProducts.find(function (oOrder) {
            return String(oOrder.OrderID) ===
                String(oSelected.OrderID);
        });

        if (oUpdated) {
            oSelectedModel.setData(
                Object.assign({}, oUpdated)
            );

            oView.getModel("selectedOrder").setData(
                Object.assign({}, oUpdated)
            );
        }
    }

    // If the customer is already viewing this order's tracking page,
    // rebuild its ProcessFlow from the latest saved order status.
    var oTrackModel = oView.getModel("trackOrder");
    var oTrackData = oTrackModel && oTrackModel.getData();
    if (oTrackData && oTrackData.orderId != null) {
        var oLatestTrackedOrder = aOrders.find(function (oOrder) {
            return String(oOrder.OrderID) === String(oTrackData.orderId);
        });

        if (oLatestTrackedOrder) {
            this._updateCustomerTrackingModel(oLatestTrackedOrder);
        }
    }
},
    onOrderedProductSelect: function (oEvent) {
    var oContext = oEvent.getSource()
        .getBindingContext("orderedProducts");

    if (!oContext) {
        return;
    }

    var oOrder = oContext.getObject();

    this.getView()
        .getModel("selectedOrderedProduct")
        .setData(Object.assign({}, oOrder));

    // Keep the existing tracking and return workflows compatible.
    this.getView()
        .getModel("selectedOrder")
        .setData(Object.assign({}, oOrder));
},

    onViewOrders: function () {
    var oAppModel = this.getView().getModel("app");

    oAppModel.setProperty("/role", "customer");
    oAppModel.setProperty("/section", "customerOrders");

    this._loadOrders();
},
    onCancelOrder: function (oEvent) {
            var oContext = oEvent.getSource()
                .getBindingContext("orderData");

            if (!oContext) {
                MessageToast.show("Order not found.");
                return;
            }

            var oOrder = oContext.getObject();

            var aCancellableStatuses = [
                "Placed",
                "Accepted",
                "Preparing",
                "Packed"
            ];

            if (aCancellableStatuses.indexOf(oOrder.Status) === -1) {
                MessageToast.show(
                    "This order can no longer be cancelled."
                );
                return;
            }

            var that = this;

            MessageBox.confirm(
                "Are you sure you want to cancel order #" +
                    oOrder.OrderID + "?",
                {
                    title: "Cancel Order",
                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],
                    emphasizedAction: MessageBox.Action.NO,

                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.YES) {
                            return;
                        }

                        var aOrders;

                        try {
                            aOrders = JSON.parse(
                                localStorage.getItem("biteDashOrders") || "[]"
                            );
                        } catch (e) {
                            MessageBox.error(
                                "Could not read saved orders."
                            );
                            return;
                        }

                        var oSavedOrder = aOrders.find(function (oItem) {
                            return String(oItem.OrderID) ===
                                String(oOrder.OrderID);
                        });

                        if (
                            !oSavedOrder ||
                            aCancellableStatuses.indexOf(
                                oSavedOrder.Status
                            ) === -1
                        ) {
                            MessageToast.show(
                                "This order can no longer be cancelled."
                            );

                            that._loadOrders();
                            return;
                        }

                        oSavedOrder.Status = "Cancelled";

                        try {
                            localStorage.setItem(
                                "biteDashOrders",
                                JSON.stringify(aOrders)
                            );
                        } catch (e) {
                            MessageBox.error(
                                "Could not save the cancellation."
                            );
                            return;
                        }

                        that._loadOrders();

                        MessageToast.show(
                            "Order cancelled successfully."
                        );
                    }
                }
            );
},
    onCancelSelectedOrder: function () {
    var that = this;
    var oSelected = this.getView()
        .getModel("selectedOrderedProduct")
        .getData();

    if (!oSelected || oSelected.OrderID == null) {
        MessageToast.show("Please select an order first.");
        return;
    }

    var aCancellableStatuses = [
        "Placed",
        "Accepted",
        "Preparing",
        "Packed"
    ];

    if (aCancellableStatuses.indexOf(oSelected.Status) === -1) {
        MessageToast.show("This order can no longer be cancelled.");
        return;
    }

    MessageBox.confirm(
        "Are you sure you want to cancel order #" +
            oSelected.OrderID + "?",
        {
            title: "Cancel Order",
            actions: [
                MessageBox.Action.YES,
                MessageBox.Action.NO
            ],
            emphasizedAction: MessageBox.Action.NO,

            onClose: function (sAction) {
                if (sAction !== MessageBox.Action.YES) {
                    return;
                }

                var aOrders;

                try {
                    aOrders = JSON.parse(
                        localStorage.getItem("biteDashOrders") || "[]"
                    );

                    if (!Array.isArray(aOrders)) {
                        aOrders = [];
                    }
                } catch (e) {
                    MessageBox.error("Could not read saved orders.");
                    return;
                }

                var oSavedOrder = aOrders.find(function (oOrder) {
                    return String(oOrder.OrderID) ===
                        String(oSelected.OrderID);
                });

                // Recheck the saved status before cancelling.
                if (!oSavedOrder ||
                    aCancellableStatuses.indexOf(oSavedOrder.Status) === -1) {
                    MessageToast.show(
                        "This order can no longer be cancelled."
                    );
                    that._loadOrders();
                    return;
                }

                oSavedOrder.Status = "Cancelled";

                try {
                    localStorage.setItem(
                        "biteDashOrders",
                        JSON.stringify(aOrders)
                    );
                } catch (e) {
                    MessageBox.error("Could not save the cancellation.");
                    return;
                }

                that._loadOrders();

                MessageToast.show("Order cancelled successfully.");
            }
        }
    );
},

//10.ORDER MANAGEMENT (BUSINESS)
    onRefreshOrders: function () {
            this._loadOrders();
            MessageToast.show("Orders refreshed");
},
    onOrderSelect: function (oEvent) {
    var oListItem = oEvent.getParameter("listItem");

    if (!oListItem) {
        oListItem = oEvent.getSource().getSelectedItem();
    }

    if (!oListItem) {
        return;
    }

    var oContext = oListItem.getBindingContext("orderData");

    if (!oContext) {
        return;
    }

    var oOrder = oContext.getObject();
    var oSelectedOrderModel = this.getView().getModel("selectedOrder");

    if (!oSelectedOrderModel) {
        sap.m.MessageBox.error("Selected order model not found.");
        return;
    }

    oSelectedOrderModel.setData(
        Object.assign({}, oOrder)
    );
},
    onSelectCustomerOrder: function (oEvent) {
    var oItem = oEvent.getSource();
    var oContext = oItem.getBindingContext("orderData");

    if (!oContext) {
        return;
    }

    var oOrder = oContext.getObject();
    var oSelectedOrderModel = this.getView().getModel("selectedOrder");

    if (!oSelectedOrderModel) {
        sap.m.MessageBox.error("Selected order model not found.");
        return;
    }

    // Show the clicked order in the right-side details panel.
    oSelectedOrderModel.setData(
        Object.assign({}, oOrder)
    );
},
    onAdvanceOrderStatus: function (oEvent) {
            var oContext = oEvent.getSource()
                .getBindingContext("orderData");

            if (!oContext) {
                MessageToast.show("Order not found.");
                return;
            }

            var oOrder = oContext.getObject();
            var aStatuses = [
                "Placed",
                "Accepted",
                "Preparing",
                "Packed",
                "Picked Up",
                "On The Way",
                "Delivered"
            ];

            var aOrders;

            try {
                aOrders = JSON.parse(
                    localStorage.getItem("biteDashOrders") || "[]"
                );
            } catch (e) {
                MessageBox.error("Could not read saved orders.");
                return;
            }

            var oSavedOrder = aOrders.find(function (oItem) {
                return String(oItem.OrderID) === String(oOrder.OrderID);
            });

            if (!oSavedOrder) {
                MessageBox.error("Saved order not found.");
                return;
            }

            if (oSavedOrder.Status === "Cancelled") {
                MessageToast.show("Cancelled orders cannot be advanced.");
                return;
            }

            var iCurrentIndex = aStatuses.indexOf(oSavedOrder.Status);

            if (iCurrentIndex === -1) {
                MessageToast.show("Unknown order status.");
                return;
            }

            if (iCurrentIndex >= aStatuses.length - 1) {
                MessageToast.show("This order is already delivered.");
                return;
            }

            oSavedOrder.Status = aStatuses[iCurrentIndex + 1];

            try {
                localStorage.setItem(
                    "biteDashOrders",
                    JSON.stringify(aOrders)
                );
            } catch (e) {
                MessageBox.error("Could not save the updated status.");
                return;
            }

            this._loadOrders();
            this._broadcastOrderUpdate(oSavedOrder);

            MessageToast.show(
                "Order status updated to " + oSavedOrder.Status
            );
},
    onAdvanceSelectedOrderStatus: function () {
    var oView = this.getView();
    var oSelectedModel = oView.getModel("selectedOrder");
    var oSelectedOrder = oSelectedModel.getData();

    if (!oSelectedOrder || oSelectedOrder.OrderID == null) {
        MessageToast.show("Please select an order first.");
        return;
    }

    var aStatuses = [
        "Placed",
        "Accepted",
        "Preparing",
        "Packed",
        "Picked Up",
        "On The Way",
        "Delivered"
    ];

    if (oSelectedOrder.Status === "Cancelled") {
        MessageToast.show("Cancelled orders cannot be updated.");
        return;
    }

    if (oSelectedOrder.Status === "Delivered") {
        MessageToast.show("This order is already delivered.");
        return;
    }

    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );

        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }
    } catch (e) {
        MessageBox.error("Could not read saved orders.");
        return;
    }

    var oSavedOrder = aOrders.find(function (oOrder) {
        return String(oOrder.OrderID) ===
            String(oSelectedOrder.OrderID);
    });

    if (!oSavedOrder) {
        MessageBox.error("Selected order was not found.");
        return;
    }

    var iCurrentIndex = aStatuses.indexOf(oSavedOrder.Status);

    if (iCurrentIndex === -1) {
        MessageBox.error("Unknown order status.");
        return;
    }

    // Advance to the next status
    oSavedOrder.Status = aStatuses[iCurrentIndex + 1];

    try {
        localStorage.setItem(
            "biteDashOrders",
            JSON.stringify(aOrders)
        );
    } catch (e) {
        MessageBox.error("Could not save the updated order.");
        return;
    }

    // Refresh the order list and dashboard counts
    this._loadOrders();
    this._broadcastOrderUpdate(oSavedOrder);

    // Keep the currently selected order visible on the right
    var oUpdatedOrder = Object.assign({}, oSavedOrder);

    oSelectedModel.setData(oUpdatedOrder);

    MessageToast.show(
        "Order status updated to " + oSavedOrder.Status
    );
},
    onDeleteSelectedOrder: function () {
    var oView = this.getView();
    var oSelectedOrderModel = oView.getModel("selectedOrder");
    var oOrderDataModel = oView.getModel("orderData");

    var oSelectedOrder = oSelectedOrderModel.getData();

    if (!oSelectedOrder || oSelectedOrder.OrderID == null) {
        sap.m.MessageToast.show("Please select an order to delete.");
        return;
    }

    var that = this;

    sap.m.MessageBox.confirm(
        "Are you sure you want to delete Order #" +
            oSelectedOrder.OrderID + "?",
        {
            title: "Delete Order",
            actions: [
                sap.m.MessageBox.Action.DELETE,
                sap.m.MessageBox.Action.CANCEL
            ],
            emphasizedAction: sap.m.MessageBox.Action.DELETE,

            onClose: function (sAction) {
                if (sAction !== sap.m.MessageBox.Action.DELETE) {
                    return;
                }

                var aOrders =
                    oOrderDataModel.getProperty("/items") || [];

                var iIndex = aOrders.findIndex(function (oOrder) {
                    return String(oOrder.OrderID) ===
                        String(oSelectedOrder.OrderID);
                });

                if (iIndex === -1) {
                    sap.m.MessageToast.show("Order not found.");
                    return;
                }

                // Remove only the selected order
                aOrders.splice(iIndex, 1);

                oOrderDataModel.setProperty("/items", aOrders);

                // Save the updated orders
                localStorage.setItem(
                    "biteDashOrders",
                    JSON.stringify(aOrders)
                );

                // Clear the selection after deletion
                oSelectedOrderModel.setData({});

                // Clear selection in the left-side list
                var oList = that.byId("businessOrdersList");
                if (oList) {
                    oList.removeSelections(true);
                }

                sap.m.MessageToast.show("Order deleted successfully.");
            }
        }
    );
},

//11.ORDER TRACKING
    onTrackOrder: function (oEvent) {

    var oView = this.getView();

    var oContext = oEvent.getSource()
        .getBindingContext("orderData");

    if (!oContext) {
        oContext = oEvent.getSource()
            .getBindingContext("orderedProducts");
    }

    if (!oContext) {
        MessageToast.show("Order details not found.");
        return;
    }

    var oOrder = Object.assign({}, oContext.getObject());

    // Synchronize both selected order models
    var oSelectedModel = oView.getModel("selectedOrder");
    var oSelectedProductModel = oView.getModel("selectedOrderedProduct");

    if (oSelectedModel) {
        oSelectedModel.setData(oOrder);
    }

    if (oSelectedProductModel) {
        oSelectedProductModel.setData(oOrder);
    }

    // Open tracking page using the selected order
    this.onTrackSelectedOrder();
},
    onTrackSelectedOrder: function () {
    var oView = this.getView();
    var oSelectedModel = oView.getModel("selectedOrderedProduct");

    if (!oSelectedModel) {
        MessageBox.error("Selected order model is not available.");
        return;
    }

    var oSelected = oSelectedModel.getData();

    if (!oSelected || oSelected.OrderID == null) {
        MessageToast.show("Please select an order first.");
        return;
    }

    // Always resolve the order again from saved data so tracking never
    // opens an older in-memory status after refresh or a new login.
    var aLatestOrders = oView.getModel("orderData").getProperty("/items") || [];
    var oLatestOrder = aLatestOrders.find(function (oOrder) {
        return String(oOrder.OrderID) === String(oSelected.OrderID);
    });

    if (!oLatestOrder) {
        MessageToast.show("This order is no longer available.");
        return;
    }

    oView.getModel("selectedOrderedProduct").setData(
        Object.assign({}, oLatestOrder)
    );
    oView.getModel("selectedOrder").setData(
        Object.assign({}, oLatestOrder)
    );
    this._updateCustomerTrackingModel(oLatestOrder);

    // Navigate to the customer tracking page.
    oView.getModel("app").setProperty("/role", "customer");
    oView.getModel("app").setProperty("/section", "customerTracking");
},

    // Build or refresh the customer tracking model from the latest order data.
    // This method does not navigate, so it can also run after restaurant updates.
    _updateCustomerTrackingModel: function (oOrder) {
    var oView = this.getView();
    var oTrackModel = oView.getModel("trackOrder");

    if (!oTrackModel || !oOrder || oOrder.OrderID == null) {
        return;
    }

    var aStatuses = [
        "Placed",
        "Approved",
        "Prepared",
        "Packed",
        "Picked Up",
        "On The Way",
        "Delivered"
    ];

    var aIcons = [
        "sap-icon://cart",
        "sap-icon://accept",
        "sap-icon://meal",
        "sap-icon://product",
        "sap-icon://shipping-status",
        "sap-icon://journey-arrive",
        "sap-icon://flag"
    ];

    var sOriginalStatus = oOrder.Status || "Placed";
    var oStatusMap = {
        "Accepted": "Approved",
        "Preparing": "Prepared"
    };
    var sStatus = oStatusMap[sOriginalStatus] || sOriginalStatus;
    var bCancelled = sStatus === "Cancelled";
    var iCurrentIndex = aStatuses.indexOf(sStatus);

    if (!bCancelled && iCurrentIndex === -1) {
        iCurrentIndex = 0;
        sStatus = "Placed";
    }

    var aLanes = aStatuses.map(function (sLabel, iIndex) {
        return {
            id: String(iIndex + 1),
            label: sLabel,
            icon: aIcons[iIndex],
            position: iIndex
        };
    });

    var aNodes = aStatuses.map(function (sLabel, iIndex) {
        var bCompleted = !bCancelled && iIndex <= iCurrentIndex;

        return {
            id: String(iIndex + 1),
            lane: String(iIndex + 1),
            title: sLabel,
            state: bCompleted ? "Positive" : "Neutral",
            stateText: bCompleted ? "Completed" : "Pending",
            texts: [bCompleted ? "Completed" : "Pending"],
            children: iIndex < aStatuses.length - 1
                ? [String(iIndex + 2)]
                : []
        };
    });

    var aItems = (oOrder.Items || []).map(function (oItem) {
        return {
            name: oItem.Name || "Food item",
            qty: Number(oItem.Quantity) || 1,
            price: Number(oItem.Price) || 0,
            notes: oItem.Description || ""
        };
    });

    var fSubtotal = aItems.reduce(function (fTotal, oItem) {
        return fTotal + (oItem.price * oItem.qty);
    }, 0);

    var fTotal = Number(oOrder.Total);
    if (!isFinite(fTotal)) {
        fTotal = fSubtotal;
    }

    oTrackModel.setData({
        orderId: oOrder.OrderID,
        status: sOriginalStatus,
        customerName: oOrder.CustomerName || "",
        address: oOrder.Address || "",
        paymentMode: oOrder.PaymentMethod || "Cash on Delivery",
        lanes: aLanes,
        nodes: aNodes,
        steps: aStatuses.map(function (sLabel, iIndex) {
            var bDone = !bCancelled && iIndex <= iCurrentIndex;
            return {
                name: sLabel,
                done: bDone,
                last: iIndex === aStatuses.length - 1,
                time: bDone ? "Completed" : "Pending"
            };
        }),
        items: aItems,
        bill: {
            subtotal: fSubtotal,
            deliveryFee: 0,
            tax: 0,
            total: fTotal
        }
    }, false);

    // Notify every bound control immediately after replacing the tracking data.
    // ProcessFlow also needs an explicit model update when its node collection changes.
    oTrackModel.refresh(true);

    var oProcessFlow = this.byId("trackingFlow");
    if (
        oProcessFlow &&
        String(this.getView().getModel("app").getProperty("/section")) === "customerTracking"
    ) {
        oProcessFlow.updateModel();
        oProcessFlow.invalidate();
    }
},

    onTrackingBack: function () {
            this._loadOrders();

            this.getView().getModel("app")
                .setProperty("/section", "customerOrders");
}, 

//12.MENU MANAGEMENT (BUSINESS)
    onRefreshMenu: function () {
            this._loadProducts();
            MessageToast.show("Refreshing menu...");
},
    onShowAddMenuItem: function () {
    var oPanel = this.byId("addMenuItemPanel");

    if (!oPanel) {
        MessageToast.show(
            "Add Menu Item panel is missing from View1.view.xml."
        );
        return;
    }

    oPanel.setVisible(true);
    oPanel.setExpanded(true);
},
    onCreateMenuItem: function () {
            var oView = this.getView();

            var sName = oView.byId("menuItemName")
                .getValue().trim();

            var sDescription = oView.byId("menuItemDescription")
                .getValue().trim();
            var fRating = oView.byId("menuItemRating").getValue();
            var sCategory = oView.byId("menuItemCategory").getSelectedKey();
            var nPrice = Number(
                oView.byId("menuItemPrice").getValue()
            );


            if (!sName) {
                MessageToast.show("Please enter the food name.");
                return;
            }

            if (!Number.isFinite(nPrice) || nPrice <= 0) {
                MessageToast.show("Please enter a valid price.");
                return;
            }
            if (fRating < 0 || fRating > 5) {
                MessageToast.show("Rating must be between 0 and 5.");
                return;
            }
            var oProductsModel = oView.getModel("products");
            var aProducts = oProductsModel.getProperty("/items") || [];
            var aSavedItems;

            try {
                aSavedItems = JSON.parse(
                    localStorage.getItem("biteDashCustomMenu") || "[]"
                );

                if (!Array.isArray(aSavedItems)) {
                    aSavedItems = [];
                }
            } catch (e) {
                MessageBox.error("Could not read saved menu items.");
                return;
            }

            var iMaxID = aProducts.concat(aSavedItems).reduce(
                function (iMax, oItem) {
                    return Math.max(iMax, Number(oItem.ID) || 0);
                },
                0
            );
            var oNewProduct = {
                ID: iMaxID + 1,
                Name: sName,
                Description: sDescription,
                Price: nPrice,
                Rating: Number(fRating) || 0,
            
                Category: sCategory,
                CategoryNames: sCategory,
                 Available: true,
                ReleaseDate: new Date().toISOString()
            };
            aSavedItems.push(oNewProduct);

            try {
                localStorage.setItem(
                    "biteDashCustomMenu",
                    JSON.stringify(aSavedItems)
                );
            } catch (e) {
                MessageBox.error(
                    "Unable to save this item in browser storage."
                );
                return;
            }

            aProducts.push(oNewProduct);
            oProductsModel.setProperty("/items", aProducts);

            var oAppModel = oView.getModel("app");

            if (oAppModel) {
                oAppModel.setProperty("/menuCount", aProducts.length);
            }

            oView.byId("menuItemName").setValue("");
            oView.byId("menuItemDescription").setValue("");
            oView.byId("menuItemPrice").setValue("");
            oView.byId("menuItemRating").setValue(0);
            oView.byId("menuItemCategory").setSelectedKey("Food");

            var oSearchField = oView.byId("foodSearchField");

            this._applyFoodFilters(
                oSearchField ? oSearchField.getValue() : ""
            );

            MessageToast.show("Menu item added successfully.");
},
onToggleAvailable: function (oEvent) {
    var bAvailable = oEvent.getParameter("state");
    var oContext = oEvent.getSource().getBindingContext("products");

    if (!oContext) {
        MessageToast.show("Could not identify this menu item.");
        return;
    }

    var oProduct = Object.assign({}, oContext.getObject(), {
        Available: bAvailable
    });
    var oProductsModel = this.getView().getModel("products");
    var aProducts = oProductsModel.getProperty("/items") || [];
    var sProductId = String(oProduct.ID);

    // Update the shared in-memory model immediately.
    var iProductIndex = aProducts.findIndex(function (oItem) {
        return String(oItem.ID) === sProductId;
    });
    if (iProductIndex !== -1) {
        aProducts[iProductIndex] = oProduct;
        oProductsModel.setProperty("/items", aProducts);
    }

    // Persist custom items and OData item overrides separately.
    try {
        var aCustomItems = JSON.parse(
            localStorage.getItem("biteDashCustomMenu") || "[]"
        );
        if (!Array.isArray(aCustomItems)) {
            aCustomItems = [];
        }

        var iCustomIndex = aCustomItems.findIndex(function (oItem) {
            return String(oItem.ID) === sProductId;
        });

        if (iCustomIndex !== -1) {
            aCustomItems[iCustomIndex] = oProduct;
            localStorage.setItem(
                "biteDashCustomMenu",
                JSON.stringify(aCustomItems)
            );
        } else {
            var aOverrides = JSON.parse(
                localStorage.getItem("biteDashMenuOverrides") || "[]"
            );
            if (!Array.isArray(aOverrides)) {
                aOverrides = [];
            }

            var iOverrideIndex = aOverrides.findIndex(function (oItem) {
                return String(oItem.ID) === sProductId;
            });

            if (iOverrideIndex === -1) {
                aOverrides.push(oProduct);
            } else {
                aOverrides[iOverrideIndex] = oProduct;
            }

            localStorage.setItem(
                "biteDashMenuOverrides",
                JSON.stringify(aOverrides)
            );
        }
    } catch (e) {
        MessageBox.error("Could not save availability. Please check browser storage.");
        return;
    }

    oProductsModel.refresh(true);
    this._refreshBusinessHome();
    MessageToast.show(
        bAvailable ? "Item is now available to customers." : "Item is hidden from customers."
    );
},
    onEditMenuItem: function (oEvent) {
    var oView = this.getView();
    var oContext = oEvent.getSource()
        .getBindingContext("products");

    if (!oContext) {
        MessageToast.show("Unable to select menu item.");
        return;
    }

    var oProduct = oContext.getObject();
    var that = this;

    // Create the edit dialog
    var oNameInput = new sap.m.Input({
        value: oProduct.Name || "",
        placeholder: "Enter food name"
    });

    var oDescriptionInput = new sap.m.TextArea({
        value: oProduct.Description || "",
        placeholder: "Enter description",
        rows: 3,
        width: "100%"
    });

    var oCategorySelect = new sap.m.Select({
        width: "100%",
        selectedKey: oProduct.Category || "Food",
        items: [
            new sap.ui.core.Item({
                key: "Food",
                text: "Food"
            }),
            new sap.ui.core.Item({
                key: "Beverages",
                text: "Beverages"
            }),
            new sap.ui.core.Item({
                key: "Electronics",
                text: "Electronics"
            })
        ]
    });

    var oPriceInput = new sap.m.Input({
        value: String(oProduct.Price || ""),
        type: "Number",
        placeholder: "Enter price"
    });

    var oRatingInput = new sap.m.RatingIndicator({
        value: Number(oProduct.Rating) || 0,
        maxValue: 5,
        iconSize: "1rem"
    });

    var oDialog = new sap.m.Dialog({
        title: "Update Menu Item",
        contentWidth: "30rem",
        content: [
            new sap.m.VBox({
                class: "sapUiSmallMargin",
                items: [
                    new sap.m.Label({ text: "Food Name" }),
                    oNameInput,

                    new sap.m.Label({
                        text: "Description",
                        class: "sapUiSmallMarginTop"
                    }),
                    oDescriptionInput,

                    new sap.m.Label({
                        text: "Category",
                        class: "sapUiSmallMarginTop"
                    }),
                    oCategorySelect,

                    new sap.m.Label({
                        text: "Price (₹)",
                        class: "sapUiSmallMarginTop"
                    }),
                    oPriceInput,

                    new sap.m.Label({
                        text: "Rating",
                        class: "sapUiSmallMarginTop"
                    }),
                    oRatingInput
                ]
            })
        ],
        beginButton: new sap.m.Button({
            text: "Save Changes",
            type: "Emphasized",
            press: function () {
                var sName = oNameInput.getValue().trim();
                var sDescription =
                    oDescriptionInput.getValue().trim();
                var sCategory = oCategorySelect.getSelectedKey();
                var nPrice = Number(oPriceInput.getValue());
                var fRating = oRatingInput.getValue();

                if (!sName) {
                    MessageToast.show("Please enter the food name.");
                    return;
                }

                if (!Number.isFinite(nPrice) || nPrice <= 0) {
                    MessageToast.show("Please enter a valid price.");
                    return;
                }

                // Update selected product
                var oUpdatedProduct = Object.assign({}, oProduct, {
                    Name: sName,
                    Description: sDescription,
                    Category: sCategory,
                    CategoryNames: sCategory,
                    Price: nPrice,
                    Rating: fRating
                });

                var oProductsModel = oView.getModel("products");
                var aProducts =
                    oProductsModel.getProperty("/items") || [];

                var iIndex = aProducts.findIndex(function (oItem) {
                    return oItem.ID === oProduct.ID;
                });

                if (iIndex === -1) {
                    MessageToast.show("Menu item not found.");
                    return;
                }

                aProducts[iIndex] = oUpdatedProduct;
                oProductsModel.setProperty("/items", aProducts);

                // Save changes to locally added menu items
                try {
                    var aSavedItems = JSON.parse(
                        localStorage.getItem("biteDashCustomMenu") || "[]"
                    );

                    var iSavedIndex = aSavedItems.findIndex(
                        function (oItem) {
                            return oItem.ID === oProduct.ID;
                        }
                    );

                    if (!Array.isArray(aSavedItems)) {
                        aSavedItems = [];
                    }

                    if (iSavedIndex !== -1) {
                        aSavedItems[iSavedIndex] = oUpdatedProduct;
                        localStorage.setItem(
                            "biteDashCustomMenu",
                            JSON.stringify(aSavedItems)
                        );
                    } else {
                        // OData products are read-only in this demo service.
                        // Keep their edits locally and merge them on every reload.
                        var aOverrides = JSON.parse(
                            localStorage.getItem("biteDashMenuOverrides") || "[]"
                        );
                        if (!Array.isArray(aOverrides)) {
                            aOverrides = [];
                        }

                        var iOverrideIndex = aOverrides.findIndex(
                            function (oItem) {
                                return String(oItem.ID) === String(oUpdatedProduct.ID);
                            }
                        );

                        if (iOverrideIndex === -1) {
                            aOverrides.push(oUpdatedProduct);
                        } else {
                            aOverrides[iOverrideIndex] = oUpdatedProduct;
                        }

                        localStorage.setItem(
                            "biteDashMenuOverrides",
                            JSON.stringify(aOverrides)
                        );
                    }
                } catch (e) {
                    MessageBox.error(
                        "Could not save the menu changes. Check browser storage and try again."
                    );
                    return;
                }

                oProductsModel.setProperty("/items", aProducts);
                oProductsModel.refresh(true);
                that._refreshBusinessHome();

                oDialog.close();

                MessageToast.show("Menu item updated successfully.");
              
            }
        }),
        endButton: new sap.m.Button({
            text: "Cancel",
            press: function () {
                oDialog.close();
            }
        }),
        afterClose: function () {
            oDialog.destroy();
        }
    });

    oView.addDependent(oDialog);
    oDialog.open();
},
    onDeleteMenuItem: function (oEvent) {
    var oView = this.getView();
    var oContext = oEvent.getSource()
        .getBindingContext("products");

    if (!oContext) {
        MessageToast.show("Unable to select menu item.");
        return;
    }

    var oProduct = oContext.getObject();

    MessageBox.confirm(
        "Are you sure you want to delete '" +
            oProduct.Name + "'?",
        {
            title: "Delete Menu Item",
            actions: [
                MessageBox.Action.DELETE,
                MessageBox.Action.CANCEL
            ],
            emphasizedAction: MessageBox.Action.DELETE,

            onClose: function (sAction) {
                if (sAction !== MessageBox.Action.DELETE) {
                    return;
                }

                var oProductsModel = oView.getModel("products");
                var aProducts =
                    oProductsModel.getProperty("/items") || [];

                // Remove item from the displayed menu
                var aRemainingProducts = aProducts.filter(
                    function (oItem) {
                        return oItem.ID !== oProduct.ID;
                    }
                );

                // Remove locally saved item, if present
                try {
                    var aSavedItems = JSON.parse(
                        localStorage.getItem("biteDashCustomMenu") || "[]"
                    );

                    aSavedItems = aSavedItems.filter(
                        function (oItem) {
                            return oItem.ID !== oProduct.ID;
                        }
                    );

                    localStorage.setItem(
                        "biteDashCustomMenu",
                        JSON.stringify(aSavedItems)
                    );
                } catch (e) {
                    MessageBox.error(
                        "Could not update saved menu items."
                    );
                    return;
                }

                oProductsModel.setProperty(
                    "/items",
                    aRemainingProducts
                );

                var oAppModel = oView.getModel("app");

                if (oAppModel) {
                    oAppModel.setProperty(
                        "/menuCount",
                        aRemainingProducts.length
                    );
                }

                MessageToast.show("Menu item deleted successfully.");
            }
        }
    );
},
    onUpdateProduct: function () {
    var oProduct = this._oSelectedMenuProduct;
    var oModel = this.getOwnerComponent().getModel();

    if (!oProduct) {
        MessageBox.warning("Please select a product first.");
        return;
    }

    var oEntitySet = this._getProductEntitySet();

    if (!oEntitySet) {
        MessageBox.error(
            "The entity set 'Products' was not found in OData metadata. " +
            "Check its actual name in $metadata."
        );
        return;
    }

    var oMetaModel = oModel.getMetaModel();
    var oEntityType = oMetaModel.getODataEntityType(
        oEntitySet.entityType
    );

    if (!oEntityType) {
        MessageBox.error("Product entity type was not found.");
        return;
    }

    var sKey = oEntityType.key.propertyRef[0].name;
    var sPath = "/" + oEntitySet.name + "(" +
        encodeURIComponent(oProduct[sKey]) + ")";

    var oName = new sap.m.Input({
        value: oProduct.Name || ""
    });

    var oDescription = new sap.m.Input({
        value: oProduct.Description || ""
    });

    var oPrice = new sap.m.Input({
        value: String(oProduct.Price == null ? "" : oProduct.Price),
        type: "Number"
    });

    var oRating = new sap.m.Input({
        value: String(oProduct.Rating == null ? 0 : oProduct.Rating),
        type: "Number"
    });

    var oDialog = new sap.m.Dialog({
        title: "Update Product",
        contentWidth: "28rem",
        content: [
            new sap.m.Label({ text: "Name" }),
            oName,
            new sap.m.Label({ text: "Description" }),
            oDescription,
            new sap.m.Label({ text: "Price" }),
            oPrice,
            new sap.m.Label({ text: "Rating (0–5)" }),
            oRating
        ],
        beginButton: new sap.m.Button({
            text: "Save",
            type: "Emphasized",
            press: function () {
                var sName = oName.getValue().trim();
                var sDescription = oDescription.getValue().trim();
                var sPrice = oPrice.getValue().trim();
                var sRating = oRating.getValue().trim();
                var fPrice = Number(sPrice);
                var fRating = Number(sRating);

                if (!sName || !sDescription ||
                    !sPrice || !sRating ||
                    !isFinite(fPrice) || fPrice < 0 ||
                    !isFinite(fRating) ||
                    fRating < 0 || fRating > 5) {
                    MessageBox.error(
                        "Enter valid product details and a rating from 0 to 5."
                    );
                    return;
                }

                // Include the exact OData entity type.
                var oPayload = {
                    __metadata: {
                        type: oEntitySet.entityType
                    },
                    Name: sName,
                    Description: sDescription,
                    Price: fPrice,
                    Rating: fRating
                };

                oModel.update(sPath, oPayload, {
                    success: function () {
                        oDialog.close();
                        MessageToast.show("Product updated.");
                        this._loadProducts();
                    }.bind(this),

                    error: function (oError) {
                        this._showODataError("Update product", oError);
                    }.bind(this)
                });
            }.bind(this)
        }),
        endButton: new sap.m.Button({
            text: "Cancel",
            press: function () {
                oDialog.close();
            }
        }),
        afterClose: function () {
            oDialog.destroy();
        }
    });

    oDialog.open();
},
    onDeleteProduct: function () {
    var that = this;
    var oProduct = this._oSelectedMenuProduct;

    if (!oProduct) {
        MessageBox.warning("Please select a product first.");
        return;
    }

    MessageBox.confirm(
        "Are you sure you want to delete '" + oProduct.Name + "'?",
        {
            title: "Delete Product",
            actions: [
                MessageBox.Action.DELETE,
                MessageBox.Action.CANCEL
            ],
            emphasizedAction: MessageBox.Action.DELETE,

            onClose: function (sAction) {
                if (sAction !== MessageBox.Action.DELETE) {
                    return;
                }

                var aSavedItems = [];

                try {
                    aSavedItems = JSON.parse(
                        localStorage.getItem("biteDashCustomMenu") || "[]"
                    );
                } catch (e) {
                    MessageBox.error("Could not read locally saved products.");
                    return;
                }

                var iLocalIndex = aSavedItems.findIndex(function (oItem) {
                    return String(oItem.ID) === String(oProduct.ID) &&
                        oItem.Name === oProduct.Name;
                });

                // Delete locally saved custom product.
                if (iLocalIndex !== -1) {
                    aSavedItems.splice(iLocalIndex, 1);

                    try {
                        localStorage.setItem(
                            "biteDashCustomMenu",
                            JSON.stringify(aSavedItems)
                        );
                    } catch (e) {
                        MessageBox.error("Could not save the menu changes.");
                        return;
                    }

                    that._oSelectedMenuProduct = null;
                    that._loadProducts();
                    MessageToast.show("Product deleted successfully.");
                    return;
                }

                // Delete OData product.
                var oModel = that.getOwnerComponent().getModel();

                if (!oModel || typeof oModel.remove !== "function") {
                    MessageBox.error("The default model is not an OData V2 model.");
                    return;
                }

                var oEntitySet = oModel.getMetaModel()
                    .getODataEntitySet("Products");

                if (!oEntitySet) {
                    MessageBox.error(
                        "The metadata does not contain an entity set named Products. Check the service metadata and manifest.json."
                    );
                    return;
                }

                var sPath = "/Products(" + oProduct.ID + ")";

                console.log("OData service URL:", oModel.sServiceUrl);
                console.log("Entity set:", oEntitySet.name);
                console.log("Delete path:", sPath);

                oModel.remove(sPath, {
                    success: function () {
                        that._oSelectedMenuProduct = null;
                        that._loadProducts();
                        MessageToast.show("Product deleted successfully.");
                    },

                    error: function (oError) {
                        that._showODataError("Delete product", oError);
                    }
                });
            }
        }
    );
},
    _getProductEntitySet: function () {
    var oModel = this.getOwnerComponent().getModel();
    var oMetaModel = oModel.getMetaModel();
    var oEntityContainer = oMetaModel.getODataEntityContainer();

    if (!oEntityContainer ||
        !oEntityContainer.entitySet) {
        return null;
    }

    var oEntitySet = oEntityContainer.entitySet.find(
        function (oSet) {
            return oSet.name === "Products";
        }
    );

    return oEntitySet || null;
},
    onMenuCategoryFilter: function (oEvent) {
    var oItem = oEvent.getParameter("item");
    var sKey = oItem ? oItem.getKey() : "all";

    this._sBusinessMenuCategory = sKey;

    var oSearchField = this.byId("businessMenuSearchField");

    this._applyBusinessMenuFilters(
        oSearchField ? oSearchField.getValue() : ""
    );
},
    onBusinessMenuSearch: function (oEvent) {
    var sQuery = oEvent.getParameter("newValue");

    // The search event uses "query" instead of "newValue"
    if (sQuery === undefined) {
        sQuery = oEvent.getParameter("query") || "";
    }

    this._applyBusinessMenuFilters(sQuery);
},
    _applyBusinessMenuFilters: function (sQuery) {
    var oMenu = this.byId("businessMenuList");

    if (!oMenu) {
        return;
    }

    var oBinding = oMenu.getBinding("items");

    if (!oBinding) {
        return;
    }

    var aFilters = [];
    var sSearch = (sQuery || "").trim();

    // Search by dish name or description
    if (sSearch) {
        aFilters.push(new Filter({
            filters: [
                new Filter(
                    "Name",
                    FilterOperator.Contains,
                    sSearch
                ),
                new Filter(
                    "Description",
                    FilterOperator.Contains,
                    sSearch
                )
            ],
            and: false
        }));
    }

    // Apply the selected category as well
    var sCategory = this._sBusinessMenuCategory || "all";

    if (sCategory !== "all") {
        aFilters.push(new Filter({
            filters: [
                new Filter(
                    "Category",
                    FilterOperator.EQ,
                    sCategory
                ),
                new Filter(
                    "CategoryNames",
                    FilterOperator.Contains,
                    sCategory
                )
            ],
            and: false
        }));
    }

    oBinding.filter(aFilters);
},

//13.RETURN MANAGEMENT (CUSTOMER)
    onStartReturnRequest: function (oEvent) {
    var oContext = oEvent.getSource().getBindingContext("orderData");

    if (!oContext) {
        sap.m.MessageToast.show("Please select a valid order.");
        return;
    }

    var oOrder = Object.assign({}, oContext.getObject());

    if (oOrder.Status !== "Delivered") {
        sap.m.MessageToast.show(
            "A return can only be requested for a delivered order."
        );
        return;
    }

    if (oOrder.ReturnStatus) {
        sap.m.MessageToast.show(
            "A return request already exists for this order."
        );
        return;
    }

    this.getView().getModel("selectedOrder").setData(oOrder);

    this.byId("returnReasonSelect").setSelectedKey("Damaged");
    this.byId("returnReasonDetails").setValue("");

    this.getView().getModel("app").setProperty(
        "/section",
        "customerReturnRequest"
    );
},
    onReturnSelectedOrder: function () {
    var oSelected = this.getView()
        .getModel("selectedOrderedProduct")
        .getData();

    if (!oSelected || oSelected.OrderID == null) {
        MessageToast.show("Please select an order first.");
        return;
    }

    if (oSelected.Status !== "Delivered") {
        MessageToast.show(
            "A return can only be requested for a delivered order."
        );
        return;
    }

    if (oSelected.ReturnStatus) {
        MessageToast.show(
            "A return request already exists for this order."
        );
        return;
    }

    this.getView()
        .getModel("selectedOrder")
        .setData(Object.assign({}, oSelected));

    this.byId("returnReasonSelect").setSelectedKey("Damaged");
    this.byId("returnReasonDetails").setValue("");

    this.getView()
        .getModel("app")
        .setProperty("/section", "customerReturnRequest");
},

    onCancelReturnRequest: function () {
    this.getView().getModel("app").setProperty(
        "/section",
        "customerOrders"
    );
},

    onOpenCustomerReturns: function () {
    this._loadReturns();
    this.getView().getModel("app").setProperty(
        "/section",
        "customerReturns"
    );
},

    onSubmitReturnRequest: function () {
    var oSelectedOrder = this.getView()
        .getModel("selectedOrder").getData();

    var sReason = this.byId("returnReasonSelect").getSelectedKey();
    var sDetails = this.byId("returnReasonDetails").getValue().trim();

    if (!oSelectedOrder.OrderID || !sReason) {
        sap.m.MessageToast.show("Please select a return reason.");
        return;
    }

    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );
    } catch (e) {
        sap.m.MessageBox.error("Unable to read saved orders.");
        return;
    }

    var oOrder = aOrders.find(function (oItem) {
        return String(oItem.OrderID) === String(oSelectedOrder.OrderID);
    });

    if (!oOrder || oOrder.Status !== "Delivered" || oOrder.ReturnStatus) {
        sap.m.MessageBox.error(
            "This order is not eligible for a new return request."
        );
        return;
    }

    oOrder.ReturnStatus = "Requested";
    oOrder.ReturnReason = sReason;
    oOrder.ReturnDetails = sDetails;
    oOrder.ReturnRequestDate = new Date().toLocaleString();
    oOrder.RefundAmount = Number(oOrder.Total || 0);
    oOrder.RefundStatus = "Pending";

    try {
        localStorage.setItem("biteDashOrders", JSON.stringify(aOrders));
    } catch (e) {
        sap.m.MessageBox.error("Could not save the return request.");
        return;
    }

    this._loadOrders();
    this._loadReturns();

    this.getView().getModel("app").setProperty(
        "/section",
        "customerReturns"
    );

    sap.m.MessageToast.show("Return request submitted successfully.");
},

//14.RETURN MANAGEMENT (BUSINESS)
    onApproveReturn: function (oEvent) {
    this._updateReturnStatus(oEvent, "Approved");
},
    onRejectReturn: function (oEvent) {
    this._updateReturnStatus(oEvent, "Rejected", "Not Applicable");
},
    onScheduleReturnPickup: function (oEvent) {
    this._updateReturnStatus(oEvent, "Pickup Scheduled");
},
    onMarkReturnPickedUp: function (oEvent) {
    this._updateReturnStatus(oEvent, "Picked Up");
},
    onCompleteReturnRefund: function (oEvent) {
    this._updateReturnStatus(oEvent, "Refunded", "Completed");
},
    _updateReturnStatus: function (oEvent, sNewStatus, sRefundStatus) {
    var oContext = oEvent.getSource().getBindingContext("returnData");

    if (!oContext) {
        sap.m.MessageToast.show("Return request not found.");
        return;
    }

    var oReturn = oContext.getObject();
    var sOrderId = String(oReturn.OrderID);
    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );
    } catch (e) {
        sap.m.MessageBox.error("Unable to read saved orders.");
        return;
    }

    var oOrder = aOrders.find(function (oItem) {
        return String(oItem.OrderID) === sOrderId;
    });

    if (!oOrder || !oOrder.ReturnStatus) {
        sap.m.MessageBox.error("The saved return request was not found.");
        return;
    }

    var sCurrentStatus = oOrder.ReturnStatus;

    var mAllowedTransitions = {
        "Requested": ["Approved", "Rejected"],
        "Approved": ["Pickup Scheduled"],
        "Pickup Scheduled": ["Picked Up"],
        "Picked Up": ["Refunded"]
    };

    if (
        !mAllowedTransitions[sCurrentStatus] ||
        mAllowedTransitions[sCurrentStatus].indexOf(sNewStatus) === -1
    ) {
        sap.m.MessageToast.show(
            "This action is not available for the current return status."
        );
        return;
    }

    oOrder.ReturnStatus = sNewStatus;

    if (sRefundStatus) {
        oOrder.RefundStatus = sRefundStatus;
    }

    if (sNewStatus === "Rejected") {
        oOrder.RefundStatus = "Not Applicable";
    }

    if (sNewStatus === "Approved") {
        oOrder.ReturnApprovedAt = new Date().toLocaleString();
    }

    if (sNewStatus === "Pickup Scheduled") {
        oOrder.ReturnPickupScheduledAt = new Date().toLocaleString();
    }

    if (sNewStatus === "Picked Up") {
        oOrder.ReturnPickedUpAt = new Date().toLocaleString();
    }

    if (sNewStatus === "Refunded") {
        oOrder.RefundStatus = "Completed";
        oOrder.RefundCompletedAt = new Date().toLocaleString();
    }

    try {
        localStorage.setItem("biteDashOrders", JSON.stringify(aOrders));
    } catch (e) {
        sap.m.MessageBox.error("Could not save the return update.");
        return;
    }

    this._loadOrders();
    this._loadReturns();

    sap.m.MessageToast.show("Return status updated: " + sNewStatus);
},

//15.RETURN SEARCH & FILTERS

onReturnSearch: function (oEvent) {

    var sSearch = oEvent.getParameter("newValue");

    // When Search is triggered by Enter or the search icon
    if (sSearch === undefined) {
        sSearch = oEvent.getParameter("query");
    }

    // Fallback to the SearchField's current value
    if (sSearch === undefined) {
        sSearch = oEvent.getSource().getValue();
    }

    this._sReturnSearch = (sSearch || "").trim().toLowerCase();

    this._applyReturnFilters();

},
onReturnFilter: function (oEvent) {

    this._sReturnFilter =
        oEvent.getParameter("key") || "all";

    this._applyReturnFilters();

},
_applyReturnFilters: function () {

    // Always use the original complete returns array
    var aReturns = this._aAllReturns || [];

    var sSearch = this._sReturnSearch || "";
    var sFilter = this._sReturnFilter || "all";

    var aFiltered = aReturns.filter(function (oReturn) {

        // Search by Order ID, Customer Name or Item
        var sOrderID = String(oReturn.OrderID || "").toLowerCase();
        var sCustomer = String(oReturn.CustomerName || "").toLowerCase();
        var sItem = String(oReturn.ItemSummary || "").toLowerCase();

        var bMatchesSearch =
            !sSearch ||
            sOrderID.indexOf(sSearch) !== -1 ||
            sCustomer.indexOf(sSearch) !== -1 ||
            sItem.indexOf(sSearch) !== -1;

        // Filter by return status
        var sStatus = oReturn.ReturnStatus;
        var bMatchesFilter = true;

        switch (sFilter) {

            case "needs":
                bMatchesFilter = sStatus === "Requested";
                break;

            case "pickup":
                bMatchesFilter =
                    sStatus === "Pickup Scheduled" ||
                    sStatus === "Picked Up";
                break;

            case "refunded":
                bMatchesFilter = sStatus === "Refunded";
                break;

            case "rejected":
                bMatchesFilter = sStatus === "Rejected";
                break;

            case "all":
            default:
                bMatchesFilter = true;
                break;
        }

        return bMatchesSearch && bMatchesFilter;

    });

    // Update only the displayed list
    this.getView()
        .getModel("returnData")
        .setProperty("/items", aFiltered);

},
    onToggleReturn: function (oEvent) {

    var oContext = oEvent.getSource()
        .getBindingContext("returnData");

    if (!oContext) {
        return;
    }

    var oModel = this.getView().getModel("returnData");
    var sPath = oContext.getPath();

    var bExpanded = oModel.getProperty(
        sPath + "/expanded"
    );

    oModel.setProperty(
        sPath + "/expanded",
        !bExpanded
    );

}, 


//16.QUICK ACTIONS
    onReviewNewOrders: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessOrders");

},
    onReviewReturns: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessReturns");

},
    onQuickAddProduct: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessMenu");

},
    onQuickManageOrders: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessOrders");

},
    onQuickReturns: function () {

    this.getView()
        .getModel("app")
        .setProperty("/section", "businessReturns");

},
    onQuickReports: function () {

     MessageToast.show("Reports section is coming soon!");

},

//17.COMMON UTILITIES
    _showODataError: function (sAction, oError) {
    var sMessage = "No detailed error was returned.";
    var sStatus = "";
    var sResponse = "";

    if (oError) {
        sStatus = oError.statusCode ||
            oError.status ||
            "";

        sResponse = oError.responseText ||
            (oError.response &&
             oError.response.body) ||
            "";

        if (sResponse) {
            try {
                var oResponse = JSON.parse(sResponse);
                var vError = oResponse.error;

                if (vError) {
                    if (typeof vError.message === "string") {
                        sMessage = vError.message;
                    } else if (vError.message &&
                               vError.message.value) {
                        sMessage = vError.message.value;
                    } else {
                        sMessage = JSON.stringify(vError);
                    }
                } else {
                    sMessage = sResponse;
                }
            } catch (e) {
                sMessage = sResponse;
            }
        } else if (oError.message) {
            sMessage = oError.message;
        }
    }

    sap.m.MessageBox.error(
        sAction + " failed." +
        (sStatus ? "\nHTTP status: " + sStatus : "") +
        "\n\n" + sMessage
    );
},

//LOGIN FUNCTIONALITY




onLogin: function () {

    var oView = this.getView();

    var sUsername = oView.byId("usernameInput").getValue().trim();
    var sPassword = oView.byId("passwordInput").getValue();
    var sSelectedRole = oView.byId("roleSelector").getSelectedKey();

    // IMPORTANT: Use View-level model for XML page bindings
    var oAppModel = oView.getModel("app");

    // Get demo users from Component model
    var oComponentModel = this.getOwnerComponent().getModel("app");
    var aUsers = oComponentModel.getProperty("/users") || [];

    if (!sUsername || !sPassword) {
        MessageBox.error("Please enter username and password");
        return;
    }

    var sLoginRole = sSelectedRole === "restaurant"
        ? "business"
        : sSelectedRole;

    var oUser = aUsers.find(function (oUser) {

        var sUserRole = oUser.role === "restaurant"
            ? "business"
            : oUser.role;

        return (
            oUser.username === sUsername &&
            oUser.password === sPassword &&
            sUserRole === sLoginRole
        );
    });

    if (!oUser) {
        MessageBox.error("Invalid username, password or role");
        return;
    }

    // Update the SAME model used by XML
    oAppModel.setProperty("/currentUser", oUser.username);
    oAppModel.setProperty("/isLoggedIn", true);
    oAppModel.setProperty("/role", sLoginRole);

    oAppModel.setProperty(
        "/section",
        sLoginRole === "customer"
            ? "customerHome"
            : "businessHome"
    );

    oView.byId("usernameInput").setValue("");
    oView.byId("passwordInput").setValue("");

    // Reload saved orders after every successful login. This restores the
    // latest restaurant-updated status in the customer's My Orders list.
    this._loadOrders();
    this._loadReturns();

    MessageToast.show(
        sLoginRole === "customer"
            ? "Welcome to BiteDash!"
            : "Welcome to Restaurant Console!"
    );
},

onLogout: function () {

    // Use the same View-level model
    var oAppModel = this.getView().getModel("app");

    oAppModel.setProperty("/isLoggedIn", false);
    oAppModel.setProperty("/currentUser", null);
    oAppModel.setProperty("/role", "customer");
    oAppModel.setProperty("/section", "customerHome");

    MessageToast.show("Logged Out");
},


onTogglePasswordVisibility: function () {

    var oPasswordInput = this.getView().byId("passwordInput");

    var bVisible = oPasswordInput.getType() === "Text";

    oPasswordInput.setType(bVisible ? "Password" : "Text");

    oPasswordInput.setValueHelpIconSrc(
        bVisible ? "sap-icon://show" : "sap-icon://hide"
    );
},

onOpenDelayDialog: function () {
    var oOrder = this.getView()
        .getModel("selectedOrder")
        .getData();

    if (!oOrder || oOrder.OrderID == null) {
        MessageToast.show("Please select an order.");
        return;
    }

    this.byId("delayReasonSelect")
        .setSelectedKey("Preparation taking longer");

    this.byId("delayMinutesSelect")
        .setSelectedKey("15");

    this.byId("delayOrderDialog").open();
},

onCloseDelayDialog: function () {
    this.byId("delayOrderDialog").close();
},

onOpenFlagDialog: function () {
    var oOrder = this.getView()
        .getModel("selectedOrder")
        .getData();

    if (!oOrder || oOrder.OrderID == null) {
        MessageToast.show("Please select an order.");
        return;
    }

    this.byId("flagReasonSelect")
        .setSelectedKey("Item unavailable");

    this.byId("flagDescriptionInput").setValue("");

    this.byId("flagOrderDialog").open();
},

onCloseFlagDialog: function () {
    this.byId("flagOrderDialog").close();
},

_updateSelectedOrder: function (fnUpdate) {
    var oSelectedModel = this.getView()
        .getModel("selectedOrder");

    var oSelectedOrder = oSelectedModel.getData();

    if (!oSelectedOrder || oSelectedOrder.OrderID == null) {
        MessageToast.show("Please select an order.");
        return false;
    }

    var aOrders;

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );

        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }
    } catch (e) {
        MessageBox.error("Could not read saved orders.");
        return false;
    }

    var oSavedOrder = aOrders.find(function (oOrder) {
        return String(oOrder.OrderID) ===
            String(oSelectedOrder.OrderID);
    });

    if (!oSavedOrder) {
        MessageBox.error("Selected order was not found.");
        return false;
    }

    if (["Delivered", "Cancelled"].indexOf(oSavedOrder.Status) >= 0) {
        MessageToast.show("This order can no longer be modified.");
        return false;
    }

    fnUpdate(oSavedOrder);

    try {
        localStorage.setItem(
            "biteDashOrders",
            JSON.stringify(aOrders)
        );
    } catch (e) {
        MessageBox.error("Could not save order changes.");
        return false;
    }

    this._loadOrders();

    oSelectedModel.setData(
        Object.assign({}, oSavedOrder)
    );

    return true;
},
onConfirmOrderDelay: function () {
    var oView = this.getView();

    var sReason = this.byId("delayReasonSelect")
        .getSelectedKey();

    var iMinutes = Number(
        this.byId("delayMinutesSelect").getSelectedKey()
    );

    if (!sReason || !iMinutes || iMinutes <= 0) {
        MessageToast.show("Please select a valid delay.");
        return;
    }

    var bSaved = this._updateSelectedOrder(function (oOrder) {
        oOrder.IsDelayed = true;
        oOrder.DelayMinutes = iMinutes;
        oOrder.DelayReason = sReason;
        oOrder.DelayUpdatedAt = new Date().toISOString();
    });

    if (!bSaved) {
        return;
    }

    this.byId("delayOrderDialog").close();

    MessageToast.show(
        "Order delayed by " + iMinutes + " minutes."
    );
},
onConfirmOrderFlag: function () {
    var sReason = this.byId("flagReasonSelect")
        .getSelectedKey();

    var sDescription = this.byId("flagDescriptionInput")
        .getValue().trim();

    if (!sReason) {
        MessageToast.show("Please select an issue reason.");
        return;
    }

    var bSaved = this._updateSelectedOrder(function (oOrder) {
        oOrder.IsFlagged = true;
        oOrder.FlagReason = sReason;
        oOrder.FlagDescription = sDescription;
        oOrder.FlaggedAt = new Date().toISOString();
    });

    if (!bSaved) {
        return;
    }

    this.byId("flagOrderDialog").close();

    MessageToast.show("Order flagged successfully.");
},
onResolveOrderFlag: function () {
    var that = this;

    MessageBox.confirm(
        "Are you sure you want to resolve this order flag?",
        {
            title: "Resolve Order Flag",

            onClose: function (sAction) {
                if (sAction !== MessageBox.Action.OK) {
                    return;
                }

                var bSaved = that._updateSelectedOrder(
                    function (oOrder) {
                        oOrder.IsFlagged = false;
                        oOrder.FlagReason = "";
                        oOrder.FlagDescription = "";
                        oOrder.FlagResolvedAt =
                            new Date().toISOString();
                    }
                );

                if (bSaved) {
                    MessageToast.show("Order flag resolved.");
                }
            }
        }
    );
},


onCheckoutNameChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^a-zA-Z ]/g, "");

    oInput.setValue(sValue);
},
onCheckoutPhoneChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^0-9]/g, "");

    oInput.setValue(sValue);
},

onCheckoutAddressChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^a-zA-Z0-9\s,./#-]/g, "");

    oInput.setValue(sValue);
},
_validateCheckoutDetails: function () {

    var oModel = this.getView().getModel("checkout");
    var oData = oModel.getData();

    var sName = (oData.CustomerName || "").trim();
    var sPhone = (oData.Phone || "").trim();
    var sAddress = (oData.Address || "").trim();

    if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(sName)) {
        sap.m.MessageBox.error("Please enter a valid full name.");
        return false;
    }

    if (!/^[6-9][0-9]{9}$/.test(sPhone)) {
        sap.m.MessageBox.error(
            "Please enter a valid 10-digit Indian mobile number."
        );
        return false;
    }

    if (
        sAddress.length < 10 ||
        !/[a-zA-Z]/.test(sAddress) ||
        !/[0-9]/.test(sAddress)
    ) {
        sap.m.MessageBox.error(
            "Please enter a complete delivery address."
        );
        return false;
    }

    return true;
},


onCheckoutAddressFieldChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^a-zA-Z0-9\s,./#-]/g, "");

    oInput.setValue(sValue);
},
onCheckoutCityChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^a-zA-Z ]/g, "");

    oInput.setValue(sValue);
},
onCheckoutStateChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^a-zA-Z ]/g, "");

    oInput.setValue(sValue);
},
onCheckoutPincodeChange: function (oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oInput.getValue();

    sValue = sValue.replace(/[^0-9]/g, "");

    oInput.setValue(sValue);
},

_validateDeliveryAddress: function () {

    var oModel = this.getView().getModel("checkout");
    var oData = oModel.getData();

    var sName = (oData.CustomerName || "").trim();
    var sPhone = (oData.Phone || "").trim();

    var sHouseNo = (oData.HouseNo || "").trim();
    var sStreet = (oData.Street || "").trim();
    var sLandmark = (oData.Landmark || "").trim();
    var sCity = (oData.City || "").trim();
    var sState = (oData.State || "").trim();
    var sPincode = (oData.Pincode || "").trim();

    // 1. Full Name
    if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(sName)) {
        sap.m.MessageBox.error(
            "Please enter a valid full name using alphabets only."
        );
        return false;
    }

    // 2. Mobile Number
    if (!/^[6-9][0-9]{9}$/.test(sPhone)) {
        sap.m.MessageBox.error(
            "Please enter a valid 10-digit Indian mobile number."
        );
        return false;
    }

    // 3. House / Flat Number
    if (
        !sHouseNo ||
        !/[a-zA-Z0-9]/.test(sHouseNo) ||
        !/^[a-zA-Z0-9\s,./#-]+$/.test(sHouseNo)
    ) {
        sap.m.MessageBox.error(
            "Please enter a valid House / Flat Number."
        );
        return false;
    }

    // 4. Street / Area
    if (
        !sStreet ||
        !/[a-zA-Z0-9]/.test(sStreet) ||
        !/^[a-zA-Z0-9\s,./#-]+$/.test(sStreet)
    ) {
        sap.m.MessageBox.error(
            "Please enter a valid Street / Area."
        );
        return false;
    }

    // 5. Landmark (Optional)
    if (
        sLandmark &&
        !/^[a-zA-Z0-9\s,./#-]+$/.test(sLandmark)
    ) {
        sap.m.MessageBox.error(
            "Please enter a valid Landmark."
        );
        return false;
    }

    // 6. City
    if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(sCity)) {
        sap.m.MessageBox.error(
            "Please enter a valid City using alphabets only."
        );
        return false;
    }

    // 7. State
    if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(sState)) {
        sap.m.MessageBox.error(
            "Please enter a valid State using alphabets only."
        );
        return false;
    }

    // 8. PIN Code
    if (!/^[1-9][0-9]{5}$/.test(sPincode)) {
        sap.m.MessageBox.error(
            "Please enter a valid 6-digit Indian PIN Code."
        );
        return false;
    }

    return true;
}






    });
});

