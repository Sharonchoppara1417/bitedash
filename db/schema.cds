namespace bitedash;

using { cuid, managed } from '@sap/cds/common';

entity Restaurants : cuid, managed {
  name        : String(120) not null;
  description : String(1000);
  phone       : String(30);
  email       : String(255);
  address     : String(500);
  city        : String(100);
  isActive    : Boolean default true;
  menuItems   : Composition of many MenuItems on menuItems.restaurant = $self;
  orders      : Association to many Orders on orders.restaurant = $self;
}

entity MenuItems : cuid, managed {
  restaurant  : Association to Restaurants not null;
  name        : String(160) not null;
  description : String(1000);
  category    : String(80);
  price       : Decimal(12,2) not null;
  currency    : String(3) default 'INR';
  imageUrl    : String(1000);
  isAvailable : Boolean default true;
}

entity Orders : cuid, managed {
  orderNumber     : String(40);
  customerName    : String(160) not null;
  customerEmail   : String(255);
  customerPhone   : String(30);
  deliveryAddress : String(1000) not null;
  restaurant      : Association to Restaurants;
  status          : String(30) default 'Placed';
  paymentMethod   : String(30);
  paymentStatus   : String(30) default 'Pending';
  totalAmount     : Decimal(12,2) not null;
  currency        : String(3) default 'INR';
  items           : Composition of many OrderItems on items.order = $self;
  history         : Composition of many OrderStatusHistory on history.order = $self;
  returns         : Composition of many ReturnRequests on returns.order = $self;
}

entity OrderItems : cuid {
  order      : Association to Orders not null;
  menuItem   : Association to MenuItems;
  itemName   : String(160) not null;
  quantity   : Integer not null;
  unitPrice  : Decimal(12,2) not null;
  lineTotal  : Decimal(12,2) not null;
}

entity OrderStatusHistory : cuid {
  order      : Association to Orders not null;
  fromStatus : String(30);
  toStatus   : String(30) not null;
  changedAt  : Timestamp not null;
  changedBy  : String(255);
  note       : String(500);
}

entity ReturnRequests : cuid, managed {
  order       : Association to Orders not null;
  reason      : String(120) not null;
  details     : String(2000);
  status      : String(30) default 'Requested';
  requestedAt : Timestamp;
}
