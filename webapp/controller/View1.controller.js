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

    return Controller.extend("bitedash.bitedash.controller.View1", {

        // 1. INITIALIZATION

onInit: function () {
    var oView = this.getView();

    // Application and navigation model
    oView.setModel(new JSONModel({
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

    // Product menu model
    oView.setModel(new JSONModel({
        items: [],
        loading: true
    }), "products");

    // Shopping cart model
    oView.setModel(new JSONModel({
        items: [],
        count: 0,
        total: 0
    }), "cart");
   
    // Orders model
    oView.setModel(new JSONModel({
        items: []
    }), "orderData");

    // Checkout model
    oView.setModel(new JSONModel({
        CustomerName: "",
        Phone: "",
        Address: "",
        PaymentIndex: 0
    }), "checkout");

    // Selected order model
    oView.setModel(new JSONModel({}), "selectedOrder");
    // Customer tracking page model
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


    // Categories model
    oView.setModel(new JSONModel({
        items: []
    }), "categories");

    // Return requests model
    oView.setModel(new JSONModel({
        items: []
    }), "returnData");

    // Ordered products model
    oView.setModel(new JSONModel({
        items: []
    }), "orderedProducts");

    // Selected product details model
    oView.setModel(new JSONModel({}), "selectedOrderedProduct");

 oView.setModel(new JSONModel({
    greeting: "Good evening, Spice Garden",
    ordersToday: 0,
    revenue: "0.0",
    rating: "4.5",
    dishesAvailable: 0,
    alerts: []
}), "homeView");

    // Load data only after all models exist
    this._loadOrders();
    this._loadProducts();
    this._loadReturns();

},
        


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

onOpenBusinessReturns: function () {
    this._loadReturns();

    this.getView().getModel("app")
        .setProperty("/section", "businessReturns");
},
// 2. LOAD PRODUCTS AND CATEGORIES
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

    // Read locally saved menu items
    function getLocalItems() {
        try {
            var aItems = JSON.parse(
                localStorage.getItem("biteDashCustomMenu") || "[]"
            );

            return Array.isArray(aItems) ? aItems : [];
        } catch (e) {
            console.error("Could not read local menu items:", e);
            return [];
        }
    }

    // Combine OData products with locally saved menu items
    function loadLocalItems(aODataProducts) {
        var aSavedItems = getLocalItems();

        aSavedItems.forEach(function (oItem) {
            oItem.CategoryNames =
                oItem.CategoryNames || oItem.Category || "Food";
        });

        var aCombined = aODataProducts.concat(aSavedItems);

        if (oProductsModel) {
            oProductsModel.setProperty("/items", aCombined);
            oProductsModel.setProperty("/loading", false);
        }
        // Refresh order details after product data becomes available.
that._prepareOrderedProducts();

        if (oAppModel) {
            oAppModel.setProperty("/menuCount", aCombined.length);
        }
        that._refreshBusinessHome();

        // Apply the current search and category filters
        var oSearch = oView.byId("foodSearchField");

        if (oView.byId("foodMenuList")) {
            that._applyFoodFilters(
                oSearch ? oSearch.getValue() : ""
            );
        }
    }

    // Check that the OData model exists
    if (!oODataModel) {
        loadLocalItems([]);

        MessageBox.error(
            "OData model is missing. Please check manifest.json."
        );
        return;
    }

    // Ensure the categories model exists
    if (!oCategoriesModel) {
        oCategoriesModel = new sap.ui.model.json.JSONModel({
            items: []
        });

        oView.setModel(oCategoriesModel, "categories");
    }

    // First load categories, then load products
    oODataModel.read("/Categories", {
        success: function (oCategoryData) {
            var aCategories = oCategoryData.results || [];

            oCategoriesModel.setProperty("/items", aCategories);

            console.log("Categories loaded:", aCategories);

            // Load products and their category relationships
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
                            if (Array.isArray(vCategories.results)) {
                                aProductCategories = vCategories.results;
                            } else if (Array.isArray(vCategories)) {
                                aProductCategories = vCategories;
                            }
                        }

                        // Map category names from the expanded relationship
                        var aNames = aProductCategories
                            .map(function (oCategory) {
                                return oCategory.Name;
                            })
                            .filter(Boolean);

                        oProduct.CategoryNames = aNames.join(" ");

                        // Keep a single category field for compatibility
                        oProduct.Category =
                            aNames.length > 0 ? aNames[0] : "";
                    });

                    loadLocalItems(aProducts);

                    MessageToast.show(
                        aProducts.length + " OData products loaded."
                    );

                    console.log("Products with categories:", aProducts);
                },

                error: function (oError) {
                    console.error("Loading products failed:", oError);

                    loadLocalItems([]);

                    MessageBox.error(
                        "Products could not be loaded. " +
                        "Locally saved menu items are still available. " +
                        "Check the Products request in the Network tab."
                    );
                }
            });
        },

        error: function (oError) {
            console.error("Loading categories failed:", oError);

            // Still try loading products if categories cannot be loaded
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

                        var aNames = aProductCategories
                            .map(function (oCategory) {
                                return oCategory.Name;
                            })
                            .filter(Boolean);

                        oProduct.CategoryNames = aNames.join(" ");
                        oProduct.Category = aNames[0] || "";
                    });

                    loadLocalItems(aProducts);
                },

                error: function (oProductError) {
                    console.error(
                        "Loading products failed:",
                        oProductError
                    );

                    loadLocalItems([]);

                    MessageBox.error(
                        "Products could not be loaded from OData. " +
                        "Locally saved menu items are still available."
                    );
                }
            });
        }
    });
},
        // 3. ROLE SWITCHING AND NAVIGATION
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
            var sSection = oEvent.getSource().data("section");

            if (!sSection) {
                return;
            }

            this.getView().getModel("app")
                .setProperty("/section", sSection);

            if (
                sSection === "customerOrders" ||
                sSection === "businessOrders"
            ) {
                this._loadOrders();
            }

            if (sSection === "customerMenu" ||
                sSection === "businessMenu") {
                this._loadProducts();
            }
            if (sSection === "businessReturns") {
            this._loadReturns();
}
        },

        onOpenMenu: function () {
            this.getView().getModel("app")
                .setProperty("/section", "customerMenu");
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


        // 4. CUSTOMER MENU SEARCH AND CATEGORY FILTERING
        onSearch: function (oEvent) {
            var sQuery =
                oEvent.getParameter("newValue") ||
                oEvent.getParameter("query") ||
                "";

            this.getView().getModel("app")
                .setProperty("/searchText", sQuery);

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
            var oSearchField = this.getView()
                .byId("foodSearchField");

            this._applyFoodFilters(
                oSearchField ? oSearchField.getValue() : ""
            );
        }, 


onFoodCategoryChange: function () {
    var oSearch = this.byId("foodSearchField");

    this._applyFoodFilters(
        oSearch ? oSearch.getValue() : ""
    );
},


onFoodCategoryChange: function () {
    var oSearch = this.byId("foodSearchField");

    this._applyFoodFilters(
        oSearch ? oSearch.getValue() : ""
    );
},



       
        // Increase cart item quantity

// Increase cart item quantity
onIncreaseCartItem: function (oEvent) {
    this._changeCartQuantity(oEvent, 1);
},
// Decrease cart item quantity
onDecreaseCartItem: function (oEvent) {
    this._changeCartQuantity(oEvent, -1);
},

// Shared quantity update logic
_changeCartQuantity: function (oEvent, iChange) {
    var oView = this.getView();
    var oContext = oEvent.getSource().getBindingContext("cart");
    var oCart = oView.getModel("cart");

    if (!oCart || !oContext) {
        sap.m.MessageToast.show("Cart item not found.");
        return;
    }

    var oSelectedItem = oContext.getObject();
    var aItems = (oCart.getProperty("/items") || []).map(function (oItem) {
        return Object.assign({}, oItem);
    });

    var iIndex = aItems.findIndex(function (oItem) {
        return String(oItem.ID) === String(oSelectedItem.ID);
    });

    if (iIndex === -1) {
        sap.m.MessageToast.show("Cart item not found.");
        return;
    }

    var iCurrentQuantity = Number(aItems[iIndex].Quantity) || 1;
    var iNewQuantity = iCurrentQuantity + iChange;

    // Remove the item when quantity reaches zero
    if (iNewQuantity <= 0) {
        aItems.splice(iIndex, 1);
    } else {
        aItems[iIndex].Quantity = iNewQuantity;
    }

    this._updateCartTotals(aItems);
},
// Remove a cart item completely
onRemoveCartItem: function (oEvent) {
    var oView = this.getView();
    var oContext = oEvent.getSource().getBindingContext("cart");
    var oCart = oView.getModel("cart");

    if (!oCart || !oContext) {
        sap.m.MessageToast.show("Cart item not found.");
        return;
    }

    var oSelectedItem = oContext.getObject();

    var aItems = (oCart.getProperty("/items") || [])
        .filter(function (oItem) {
            return String(oItem.ID) !== String(oSelectedItem.ID);
        })
        .map(function (oItem) {
            return Object.assign({}, oItem);
        });

    this._updateCartTotals(aItems);

    sap.m.MessageToast.show(
        (oSelectedItem.Name || "Item") + " removed from cart."
    );
},
// Recalculate cart quantity and total
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

    aItems.forEach(function (oItem) {
        var iQuantity = Math.max(0, Number(oItem.Quantity) || 0);
        var fPrice = Math.max(0, Number(oItem.Price) || 0);

        oItem.Quantity = iQuantity;
        iCount += iQuantity;
        fTotal += fPrice * iQuantity;
    });

    // Update the same model used by the cart XML
    oCart.setProperty("/items", aItems);
    oCart.setProperty("/count", iCount);
    oCart.setProperty("/total", Number(fTotal.toFixed(2)));

    if (oApp) {
        oApp.setProperty("/cartCount", iCount);
    }
},
// Proceed to checkout
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

    // Keep the cart count and total synchronized before navigating
    this._updateCartTotals(aItems);

    oApp.setProperty("/section", "checkout");
},

// Add the selected menu product to the cart
onAddSelectedProductToCart: function () {
    var oView = this.getView();
    var oProduct = this._oSelectedMenuProduct;
    var oCart = oView.getModel("cart");
    var oApp = oView.getModel("app");

    if (!oProduct) {
        sap.m.MessageToast.show("Please select a product first.");
        return;
    }

    if (!oCart) {
        sap.m.MessageBox.error("Cart model not found.");
        return;
    }

    var aItems = (oCart.getProperty("/items") || []).map(function (oItem) {
        return Object.assign({}, oItem);
    });

    var iIndex = aItems.findIndex(function (oItem) {
        return String(oItem.ID) === String(oProduct.ID);
    });

    if (iIndex !== -1) {
        // Product already exists in cart: increase its quantity
        aItems[iIndex].Quantity =
            (Number(aItems[iIndex].Quantity) || 1) + 1;
    } else {
        // Add a separate copy so the menu object is not modified
        var oNewItem = Object.assign({}, oProduct);
        oNewItem.Quantity = 1;
        aItems.push(oNewItem);
    }

    this._updateCartTotals(aItems);

    sap.m.MessageToast.show(
        (oProduct.Name || "Product") + " added to cart."
    );

    // Clear the menu table selection
    var oTable = this.byId("foodMenuList");

    if (oTable) {
        oTable.removeSelections(true);
    }

    this._oSelectedMenuProduct = null;

    if (oApp) {
        oApp.setProperty("/canAddSelectedProduct", false);
    }
},
// Return to the cart from checkout
onBackToCart: function () {
    var oApp = this.getView().getModel("app");

    if (oApp) {
        oApp.setProperty("/section", "customerCart");
    }
},
onOpenCart: function () {
    this.getView()
        .getModel("app")
        .setProperty("/section", "customerCart");
},





       
     

        onPlaceOrder: function () {
            var oView = this.getView();
            var oCheckout = oView.getModel("checkout");
            var oCart = oView.getModel("cart");
            var oApp = oView.getModel("app");

            var oDetails = oCheckout.getData();
            var aItems = oCart.getProperty("/items") || [];

            if (!aItems.length) {
                MessageToast.show("Your cart is empty.");
                oApp.setProperty("/section", "customerMenu");
                return;
            }

            if (!oDetails.CustomerName ||
                !oDetails.CustomerName.trim()) {
                MessageToast.show("Please enter your name.");
                return;
            }

            if (!/^[0-9]{10}$/.test(oDetails.Phone || "")) {
                MessageToast.show("Enter a valid 10-digit mobile number.");
                return;
            }

            if (!oDetails.Address ||
                !oDetails.Address.trim()) {
                MessageToast.show("Please enter your delivery address.");
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
                MessageBox.error("Unable to read saved orders.");
                return;
            }

            var fTotal = Number(oCart.getProperty("/total")) || 0;

            var iNextId = aOrders.reduce(function (iMax, oOrder) {
                return Math.max(iMax, Number(oOrder.OrderID) || 0);
            }, 0) + 1;

            var aPaymentMethods = [
                "Cash on Delivery",
                "UPI (demo)",
                "Card (demo)"
            ];

            var oOrder = {
                OrderID: iNextId,
                CustomerName: oDetails.CustomerName.trim(),
                Phone: oDetails.Phone,
                Address: oDetails.Address.trim(),
                PaymentMethod:
                    aPaymentMethods[oDetails.PaymentIndex] ||
                    "Cash on Delivery",
                Items: aItems.map(function (oItem) {
                    return {
                        ID: oItem.ID,
                        Name: oItem.Name,
                        Description: oItem.Description || "",
                        Rating: Number(oItem.Rating) || 0,
                        Price: Number(oItem.Price) || 0,
                        Quantity: Number(oItem.Quantity) || 1
                    };
                }),
                Total: fTotal,
                OrderDate: new Date().toISOString(),
                Status: "Placed"
            };

            aOrders.push(oOrder);

            try {
                localStorage.setItem(
                    "biteDashOrders",
                    JSON.stringify(aOrders)
                );
            } catch (e) {
                MessageBox.error(
                    "The order could not be saved in browser storage."
                );
                return;
            }

            // Refresh the order list immediately
            this._loadOrders();

            // Clear cart
            oCart.setData({
                items: [],
                count: 0,
                total: 0
            });

            oApp.setProperty("/cartCount", 0);

            // Reset checkout form
            oCheckout.setData({
                CustomerName: "",
                Phone: "",
                Address: "",
                PaymentIndex: 0
            });

            MessageBox.success(
                "Your order has been placed successfully! Order ID: " +
                oOrder.OrderID,
                {
                    title: "Order Confirmed",
                    onClose: function () {
                        oApp.setProperty("/section", "customerOrders");
                    }
                }
            );
        },


  
 // 7. LOAD ORDERS AND DASHBOARD COUNTS
_loadOrders: function () {
    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );

        if (!Array.isArray(aOrders)) {
            aOrders = [];
        }
    } catch (e) {
        MessageToast.show("Could not read saved orders.");
        console.error("Order loading failed:", e);
        aOrders = [];
    }

    aOrders.forEach(function (oOrder) {
        // Build product summary
        oOrder.ItemSummary = (oOrder.Items || [])
            .map(function (oItem) {
                return oItem.Name + " × " + oItem.Quantity;
            })
            .join(", ");

        oOrder.Total = Number(oOrder.Total) || 0;
    });

    // Update orders model
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

    if (oAppModel) {
        oAppModel.setProperty("/incomingOrders", iIncomingOrders);
        oAppModel.setProperty("/preparingOrders", iPreparingOrders);
        oAppModel.setProperty("/deliveredOrders", iDeliveredOrders);
    }
   

    // Refresh the ordered products list
    this._prepareOrderedProducts();
     this._refreshBusinessHome();
},

        onRefreshOrders: function () {
            this._loadOrders();
            MessageToast.show("Orders refreshed");
        },

        // 8. RESTAURANT ORDER STATUS UPDATES
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

            MessageToast.show(
                "Order status updated to " + oSavedOrder.Status
            );
        },
        // 9. RESTAURANT MENU MANAGEMENT
        onRefreshMenu: function () {
            this._loadProducts();
            MessageToast.show("Refreshing menu...");
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

                    if (iSavedIndex !== -1) {
                        aSavedItems[iSavedIndex] = oUpdatedProduct;

                        localStorage.setItem(
                            "biteDashCustomMenu",
                            JSON.stringify(aSavedItems)
                        );
                    }
                } catch (e) {
                    MessageBox.error(
                        "Could not save the menu changes."
                    );
                    return;
                }

                oProductsModel.refresh(true);
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


        // 10. CUSTOMER ORDER TRACKING
        onTrackOrder: function (oEvent) {
            var oContext = oEvent.getSource()
                .getBindingContext("orderData");

            if (!oContext) {
                MessageToast.show("Order details not found.");
                return;
            }

            this.getView()
                .getModel("selectedOrder")
                .setData(Object.assign({}, oContext.getObject()));

            this.getView().getModel("app")
                .setProperty("/section", "customerTracking");
        },

        onTrackingBack: function () {
            this._loadOrders();

            this.getView().getModel("app")
                .setProperty("/section", "customerOrders");
        },
        // 11. CUSTOMER ORDER CANCELLATION
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


        
_loadReturns: function () {
    var aOrders = [];

    try {
        aOrders = JSON.parse(
            localStorage.getItem("biteDashOrders") || "[]"
        );
    } catch (e) {
        sap.m.MessageToast.show("Could not load return requests.");
    }

    var aReturns = aOrders
        .filter(function (oOrder) {
            return !!oOrder.ReturnStatus;
        })
        .map(function (oOrder) {
            var aItems = oOrder.Items || [];

            return Object.assign({}, oOrder, {
                ItemSummary: oOrder.ItemSummary ||
                    aItems.map(function (oItem) {
                        return oItem.Name + " × " + oItem.Quantity;
                    }).join(", "),
                RefundAmount: Number(
                    oOrder.RefundAmount != null
                        ? oOrder.RefundAmount
                        : oOrder.Total || 0
                )
            });
        });

    this.getView().getModel("returnData").setProperty(
        "/items",
        aReturns
    );

    this.getView().getModel("app").setProperty(
        "/returnCount",
        aReturns.filter(function (oReturn) {
            return oReturn.ReturnStatus !== "Rejected" &&
                oReturn.ReturnStatus !== "Refunded";
        }).length
    );
    this._refreshBusinessHome();
},


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

onCancelReturnRequest: function () {
    this.getView().getModel("app").setProperty(
        "/section",
        "customerOrders"
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
        "customerOrders"
    );

    sap.m.MessageToast.show("Return request submitted successfully.");
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






onMenuCategoryButton: function (oEvent) {
    var sCategory = oEvent.getSource().data("category") || "All";

    this._sMenuCategory = sCategory;

    // Clear the previous product selection when changing category
    var oTable = this.byId("foodMenuList");

    if (oTable) {
        oTable.removeSelections(true);
    }

    this._oSelectedMenuProduct = null;

    this.getView()
        .getModel("app")
        .setProperty("/canAddSelectedProduct", false);

    this._applyFoodFilters();
},

onMenuProductSelect: function (oEvent) {
    var oTable = oEvent.getSource();
    var oSelectedItem = oEvent.getParameter("listItem");

    // Also support deselecting a previously selected row
    if (!oSelectedItem || !oSelectedItem.getSelected()) {
        oSelectedItem = oTable.getSelectedItem();
    }

    if (!oSelectedItem) {
        this._oSelectedMenuProduct = null;
        this.getView()
            .getModel("app")
            .setProperty("/canAddSelectedProduct", false);
        return;
    }

    this._oSelectedMenuProduct = Object.assign(
        {},
        oSelectedItem.getBindingContext("products").getObject()
    );

    this.getView()
        .getModel("app")
        .setProperty("/canAddSelectedProduct", true);
},

_applyFoodFilters: function () {
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

    // Search by product name or description
    var sSearch = this.byId("foodSearchField")
        ? this.byId("foodSearchField").getValue().trim()
        : "";

    if (sSearch) {
        aFilters.push(new Filter({
            filters: [
                new Filter("Name", FilterOperator.Contains, sSearch),
                new Filter("Description", FilterOperator.Contains, sSearch)
            ],
            and: false
        }));
    }

    // Filter by the category selected on the left
    var sCategory = this._sMenuCategory || "All";

    if (sCategory !== "All") {
        aFilters.push(new Filter({
            filters: [
                new Filter("Category", FilterOperator.EQ, sCategory),
                new Filter("CategoryNames", FilterOperator.Contains, sCategory)
            ],
            and: false
        }));
    }

    oBinding.filter(aFilters);
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

    // Keep the currently selected order visible on the right
    var oUpdatedOrder = Object.assign({}, oSavedOrder);

    oSelectedModel.setData(oUpdatedOrder);

    MessageToast.show(
        "Order status updated to " + oSavedOrder.Status
    );
},





_prepareOrderedProducts: function () {
    var oOrdersModel = this.getView().getModel("orderData");
    var oProductsModel = this.getView().getModel("products");

    var aOrders = oOrdersModel.getProperty("/items") || [];
    var aProducts = oProductsModel.getProperty("/items") || [];

    var aOrderedProducts = aOrders.map(function (oOrder) {
        var aItems = (oOrder.Items || []).map(function (oItem) {
            var oProduct = aProducts.find(function (p) {
                return String(p.ID) === String(oItem.ID);
            }) || {};

            return {
                ID: oItem.ID,
                Name: oItem.Name || oProduct.Name || "Product",
               Description: oItem.Description || oProduct.Description || "No description available",

Rating: Number(oItem.Rating) > 0
    ? Number(oItem.Rating)
    : (Number(oProduct.Rating) || 0),
                Price: Number(oItem.Price) || 0,
                Quantity: Number(oItem.Quantity) || 1
            };
        });

        var nTotal = aItems.reduce(function (nSum, oItem) {
            return nSum + oItem.Price * oItem.Quantity;
        }, 0);

        return {
            OrderID: oOrder.OrderID,
            OrderDate: oOrder.OrderDate,
            CustomerName: oOrder.CustomerName,
            Address: oOrder.Address, // ADD THIS LINE
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

    this.getView().getModel("orderedProducts").setProperty(
        "/items",
        aOrderedProducts
    );

    var oSelectedModel = this.getView().getModel("selectedOrderedProduct");
    var oSelected = oSelectedModel.getData();

    if (oSelected && oSelected.OrderID) {
        var oUpdated = aOrderedProducts.find(function (oOrder) {
            return String(oOrder.OrderID) === String(oSelected.OrderID);
        });

        if (oUpdated) {
            oSelectedModel.setData(
                Object.assign({}, oUpdated)
            );

            this.getView().getModel("selectedOrder").setData(
                Object.assign({}, oUpdated)
            );
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



onTrackSelectedOrder: function () {
    var oView = this.getView();

    var oSelected = oView
        .getModel("selectedOrderedProduct")
        .getData();

    if (!oSelected || oSelected.OrderID == null) {
        MessageToast.show("Please select an order first.");
        return;
    }

    // Seven tracking statuses
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

    // Convert actual order statuses into tracking statuses
    var sStatus = oSelected.Status || "Placed";

    var oStatusMap = {
        "Accepted": "Approved",
        "Preparing": "Prepared"
    };

    sStatus = oStatusMap[sStatus] || sStatus;

    // Find the current tracking position
    var iCurrentIndex = aStatuses.indexOf(sStatus);

    // Handle cancelled orders without marking any lane completed
    var bCancelled = sStatus === "Cancelled";

    if (bCancelled) {
        iCurrentIndex = -1;
    } else if (iCurrentIndex < 0) {
        iCurrentIndex = 0;
        sStatus = "Placed";
    }

    // Create seven lane headers
    var aLanes = aStatuses.map(function (sLabel, iIndex) {
        return {
            id: String(iIndex + 1),
            label: sLabel,
            icon: aIcons[iIndex],
            position: iIndex
        };
    });

    // Create seven nodes to control lane colors
    var aNodes = aStatuses.map(function (sLabel, iIndex) {
        var bCompleted = !bCancelled &&
            iIndex <= iCurrentIndex;

        return {
            id: String(iIndex + 1),
            lane: String(iIndex + 1),
            title: sLabel,

            // Completed/current lanes green; remaining lanes grey
            state: bCompleted ? "Positive" : "Neutral",

            stateText: bCompleted ? "Completed" : "Pending",
            texts: [
                bCompleted ? "Completed" : "Pending"
            ],

            // Connect each step to the next
            children: iIndex < aStatuses.length - 1
                ? [String(iIndex + 2)]
                : []
        };
    });

    // Prepare ordered items
    var aItems = (oSelected.Items || []).map(function (oItem) {
        return {
            name: oItem.Name || "Food item",
            qty: Number(oItem.Quantity) || 1,
            price: Number(oItem.Price) || 0,
            notes: oItem.Description || ""
        };
    });

    // Calculate item subtotal
    var fSubtotal = aItems.reduce(function (fTotal, oItem) {
        return fTotal + oItem.price * oItem.qty;
    }, 0);

    var fTotal = Number(oSelected.Total);

    if (!isFinite(fTotal)) {
        fTotal = fSubtotal;
    }

    // Update tracking model
    oView.getModel("trackOrder").setData({
        orderId: oSelected.OrderID,
        status: sStatus,
        customerName: oSelected.CustomerName || "",
        address: oSelected.Address || "",
        paymentMode: oSelected.PaymentMethod || "Cash on Delivery",

        lanes: aLanes,
        nodes: aNodes,

        steps: aStatuses.map(function (sLabel, iIndex) {
            var bDone = !bCancelled &&
                iIndex <= iCurrentIndex;

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
    });

    // Keep existing selected order details synchronized
    oView.getModel("selectedOrder").setData(
        Object.assign({}, oSelected)
    );

    // Open tracking page
    oView.getModel("app").setProperty(
        "/section",
        "customerTracking"
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

//onShowAddMenuItem: function () {
  //  this.byId("addMenuItemPanel").setExpanded(true);
//},



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










    });
});

