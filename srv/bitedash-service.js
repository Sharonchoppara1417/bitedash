const cds = require('@sap/cds');
const { SELECT, UPDATE, INSERT } = cds.ql;

const ORDER_TRANSITIONS = {
  Placed: 'Accepted',
  Accepted: 'Preparing',
  Preparing: 'Packed',
  Packed: 'Picked Up',
  'Picked Up': 'On The Way',
  'On The Way': 'Delivered'
};

const RETURN_TRANSITIONS = {
  Requested: ['Approved', 'Rejected'],
  Approved: ['Pickup Scheduled'],
  'Pickup Scheduled': ['Picked Up'],
  'Picked Up': ['Refunded']
};

module.exports = class BiteDashService extends cds.ApplicationService {
  async init() {
    const { Orders, OrderStatusHistory, ReturnRequests } = this.entities;

    // Keep status changes behind the validated actions below.
    this.before('UPDATE', Orders, req => {
      if (Object.prototype.hasOwnProperty.call(req.data, 'status')) {
        req.reject(400, 'Use advanceStatus or cancelOrder to change an order status.');
      }
    });

    this.before('UPDATE', ReturnRequests, req => {
      if (Object.prototype.hasOwnProperty.call(req.data, 'status')) {
        req.reject(400, 'Use advanceReturnStatus to change a return status.');
      }
    });

    this.before('CREATE', Orders, req => {
      req.data.status = 'Placed';
      req.data.paymentStatus = req.data.paymentStatus || 'Pending';
      req.data.currency = req.data.currency || 'INR';
    });

    this.before('CREATE', ReturnRequests, req => {
      req.data.status = 'Requested';
      req.data.requestedAt = req.data.requestedAt || new Date();
    });

    this.on('advanceStatus', 'Orders', async req => {
      const orderID = req.params?.[0]?.ID;
      const nextStatus = req.data?.nextStatus;

      if (!orderID) return req.reject(400, 'Order ID is required.');
      if (!nextStatus) return req.reject(400, 'Next order status is required.');

      const tx = cds.tx(req);
      const order = await tx.run(SELECT.one.from(Orders).where({ ID: orderID }));
      if (!order) return req.reject(404, 'Order not found.');

      const expectedStatus = ORDER_TRANSITIONS[order.status];
      if (!expectedStatus || expectedStatus !== nextStatus) {
        return req.reject(
          409,
          'Invalid order transition from ' + order.status + ' to ' + nextStatus + '.'
        );
      }

      await tx.run(UPDATE(Orders).set({ status: nextStatus }).where({ ID: orderID }));
      await tx.run(INSERT.into(OrderStatusHistory).entries({
        order_ID: orderID,
        fromStatus: order.status,
        toStatus: nextStatus,
        changedAt: new Date(),
        changedBy: req.user?.id || 'system'
      }));

      return nextStatus;
    });

    this.on('cancelOrder', 'Orders', async req => {
      const orderID = req.params?.[0]?.ID;
      if (!orderID) return req.reject(400, 'Order ID is required.');

      const tx = cds.tx(req);
      const order = await tx.run(SELECT.one.from(Orders).where({ ID: orderID }));
      if (!order) return req.reject(404, 'Order not found.');

      if (!['Placed', 'Accepted'].includes(order.status)) {
        return req.reject(409, 'An order can only be cancelled while it is Placed or Accepted.');
      }

      await tx.run(UPDATE(Orders).set({ status: 'Cancelled' }).where({ ID: orderID }));
      await tx.run(INSERT.into(OrderStatusHistory).entries({
        order_ID: orderID,
        fromStatus: order.status,
        toStatus: 'Cancelled',
        changedAt: new Date(),
        changedBy: req.user?.id || 'system',
        note: 'Cancelled by customer'
      }));

      return 'Cancelled';
    });

    this.on('advanceReturnStatus', 'ReturnRequests', async req => {
      const returnID = req.params?.[0]?.ID;
      const nextStatus = req.data?.nextStatus;

      if (!returnID) return req.reject(400, 'Return request ID is required.');
      if (!nextStatus) return req.reject(400, 'Next return status is required.');

      const tx = cds.tx(req);
      const returnRequest = await tx.run(
        SELECT.one.from(ReturnRequests).where({ ID: returnID })
      );
      if (!returnRequest) return req.reject(404, 'Return request not found.');

      const allowedStatuses = RETURN_TRANSITIONS[returnRequest.status] || [];
      if (!allowedStatuses.includes(nextStatus)) {
        return req.reject(
          409,
          'Invalid return transition from ' + returnRequest.status + ' to ' + nextStatus + '.'
        );
      }

      await tx.run(
        UPDATE(ReturnRequests).set({ status: nextStatus }).where({ ID: returnID })
      );

      return nextStatus;
    });

    return super.init();
  }
};
