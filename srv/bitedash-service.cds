using { bitedash as db } from '../db/schema';

@path: '/odata/v1/bitedash'
service BiteDashService {
  entity Restaurants as projection on db.Restaurants;

  entity MenuItems as projection on db.MenuItems;

  entity Orders as projection on db.Orders actions {
    action advanceStatus(nextStatus : String) returns String;
    action cancelOrder() returns String;
  };

  entity OrderItems as projection on db.OrderItems;

  entity OrderStatusHistory as projection on db.OrderStatusHistory;

  entity ReturnRequests as projection on db.ReturnRequests actions {
    action advanceReturnStatus(nextStatus : String) returns String;
  };
}
