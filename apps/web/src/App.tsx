import { useEffect, useMemo, useState } from 'react';
import './App.css';
import logo from './assets/babylon-logo.png';
import {
  fetchRequests,
  fetchRequestThread,
  fetchRfqs,
  fetchRfqDetail,
  fetchOrders,
  fetchOrderDetail,
  fetchNotifications,
  postRequestMessage,
  transitionRequest,
  fetchMeta,
  fetchServices,
  fetchServiceAssignments,
  assignService,
  approveService,
  fetchInventoryEvents,
  type RequestItem,
  type ThreadMessage,
  type RfqItem,
  type OrderItem,
  type NotificationItem,
  type OrderDetail,
} from './api';
import { useOrderDocuments } from './hooks/useDocuments';

type Actor = 'customer' | 'internal';
type PageKey =
  | 'dashboard'
  | 'requests'
  | 'request-detail'
  | 'rfqs'
  | 'rfq-detail'
  | 'orders'
  | 'order-detail'
  | 'notifications';

type AuthCtx = {
  customerId: string;
  membershipId: string;
  actor: Actor;
  name: string;
  email: string;
};

type ServiceItem = {
  id: string;
  name: string;
  attachTo: string;
  chargeable: boolean;
  status: string;
};

type AppErrors = {
  load?: string;
  thread?: string;
  rfq?: string;
  order?: string;
  action?: string;
};

const USER_PRESETS: Record<Actor, { name: string; email: string; password: string }> = {
  internal: {
    name: 'Alice Internal',
    email: 'alice@babylon.internal',
    password: 'internal123',
  },
  customer: {
    name: 'Bob Acme',
    email: 'bob@acme.com',
    password: 'customer123',
  },
};

function buildAuth(actor: Actor): AuthCtx {
  const customerId = (import.meta.env.VITE_CUSTOMER_ID as string) || 'demo-customer';
  const customerMembership = (import.meta.env.VITE_MEMBERSHIP_ID as string) || 'demo-membership';
  const internalMembership =
    (import.meta.env.VITE_INTERNAL_MEMBERSHIP_ID as string | undefined) || customerMembership;

  return {
    customerId,
    membershipId: actor === 'internal' ? internalMembership : customerMembership,
    actor,
    name: USER_PRESETS[actor].name,
    email: USER_PRESETS[actor].email,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getPageLabel(page: PageKey): string {
  switch (page) {
    case 'dashboard':
      return 'Dashboard';
    case 'requests':
      return 'Requests';
    case 'request-detail':
      return 'Request Detail';
    case 'rfqs':
      return 'RFQs';
    case 'rfq-detail':
      return 'RFQ Detail';
    case 'orders':
      return 'Orders';
    case 'order-detail':
      return 'Order Detail';
    case 'notifications':
      return 'Notifications';
    default:
      return 'CRM';
  }
}

function App() {
  const [auth, setAuth] = useState<AuthCtx | null>(null);
  const [page, setPage] = useState<PageKey>('dashboard');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [rfqs, setRfqs] = useState<RfqItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<{
    orderStates: { state: string; docs: string[]; notes: string }[];
    requestStates: string[];
  } | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inventoryEvents, setInventoryEvents] = useState<
    { ts: string; type: string; order_number: string; detail: string }[]
  >([]);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [rfqDetail, setRfqDetail] = useState<{
    rfq: RfqItem;
    items: { sku: string; qty: number }[];
  } | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [serviceAssignments, setServiceAssignments] = useState<
    { serviceId: string; status: string }[]
  >([]);

  const [comment, setComment] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AppErrors>({});

  const {
    docs: orderDocs,
    load: loadOrderDocs,
    upload: uploadOrderDoc,
    loading: docsLoading,
    error: docError,
  } = useOrderDocuments(selectedOrderId);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  const activeNav: 'dashboard' | 'requests' | 'rfqs' | 'orders' | 'notifications' = (() => {
    if (page === 'request-detail') return 'requests';
    if (page === 'rfq-detail') return 'rfqs';
    if (page === 'order-detail') return 'orders';
    if (
      page === 'dashboard' ||
      page === 'requests' ||
      page === 'rfqs' ||
      page === 'orders' ||
      page === 'notifications'
    ) {
      return page;
    }
    return 'dashboard';
  })();

  const loadWorkspace = async (session: AuthCtx) => {
    setIsLoading(true);
    setErrors({});
    try {
      const [requestData, rfqData, orderData, notificationData, metaData, servicesData, eventsData] =
        await Promise.all([
          fetchRequests(session),
          fetchRfqs(session),
          fetchOrders(session),
          fetchNotifications(session),
          fetchMeta(),
          fetchServices(),
          fetchInventoryEvents(),
        ]);

      setRequests(requestData);
      setRfqs(rfqData);
      setOrders(orderData);
      setNotifications(notificationData);
      setMeta(metaData);
      setServices(servicesData.services);
      setInventoryEvents(eventsData.events);

      setSelectedRequestId(
        (current) => requestData.find((item) => item.id === current)?.id || requestData[0]?.id || null,
      );
      setSelectedRfqId(
        (current) => rfqData.find((item) => item.id === current)?.id || rfqData[0]?.id || null,
      );
      setSelectedOrderId(
        (current) => orderData.find((item) => item.id === current)?.id || orderData[0]?.id || null,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load workspace';
      setErrors({ load: message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) return;
    void loadWorkspace(auth);
  }, [auth]);

  useEffect(() => {
    if (!auth || !selectedRequestId) {
      setThread([]);
      return;
    }

    const loadThread = async () => {
      try {
        const data = await fetchRequestThread(selectedRequestId, auth);
        setThread(data.messages);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load request thread';
        setErrors((current) => ({ ...current, thread: message }));
      }
    };

    void loadThread();
  }, [auth, selectedRequestId]);

  useEffect(() => {
    if (!auth || !selectedRfqId) {
      setRfqDetail(null);
      return;
    }

    const loadDetail = async () => {
      try {
        const detail = await fetchRfqDetail(selectedRfqId, auth);
        setRfqDetail(detail);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load RFQ detail';
        setErrors((current) => ({ ...current, rfq: message }));
      }
    };

    void loadDetail();
  }, [auth, selectedRfqId]);

  useEffect(() => {
    if (!auth || !selectedOrderId) {
      setOrderDetail(null);
      setServiceAssignments([]);
      return;
    }

    const loadDetail = async () => {
      try {
        const [detail, assignments] = await Promise.all([
          fetchOrderDetail(selectedOrderId, auth),
          fetchServiceAssignments(selectedOrderId),
        ]);
        setOrderDetail(detail);
        setServiceAssignments(assignments.assignments);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load order detail';
        setErrors((current) => ({ ...current, order: message }));
      }
    };

    void loadDetail();
  }, [auth, selectedOrderId]);

  useEffect(() => {
    void loadOrderDocs();
  }, [loadOrderDocs, selectedOrderId]);

  const handleLogin = () => {
    const normalizedEmail = loginForm.email.trim().toLowerCase();
    const matchedActor = (Object.keys(USER_PRESETS) as Actor[]).find((actor) => {
      const preset = USER_PRESETS[actor];
      return preset.email === normalizedEmail && preset.password === loginForm.password;
    });

    if (!matchedActor) {
      setLoginError('Invalid email or password');
      return;
    }

    setAuth(buildAuth(matchedActor));
    setLoginError(null);
    setPage('dashboard');
  };

  const logout = () => {
    setAuth(null);
    setPage('dashboard');
    setLoginForm({ email: '', password: '' });
    setLoginError(null);
    setRequests([]);
    setRfqs([]);
    setOrders([]);
    setNotifications([]);
    setMeta(null);
    setServices([]);
    setInventoryEvents([]);
    setSelectedRequestId(null);
    setSelectedRfqId(null);
    setSelectedOrderId(null);
    setThread([]);
    setRfqDetail(null);
    setOrderDetail(null);
    setServiceAssignments([]);
    setComment('');
    setNewDocName('');
    setSelectedServiceId('');
    setErrors({});
  };

  const switchActor = (actor: Actor) => {
    setAuth(buildAuth(actor));
    setPage('dashboard');
  };

  const openRequestDetail = (id: string) => {
    setSelectedRequestId(id);
    setPage('request-detail');
    setErrors((current) => ({ ...current, thread: undefined, action: undefined }));
  };

  const openRfqDetail = (id: string) => {
    setSelectedRfqId(id);
    setPage('rfq-detail');
    setErrors((current) => ({ ...current, rfq: undefined }));
  };

  const openOrderDetail = (id: string) => {
    setSelectedOrderId(id);
    setPage('order-detail');
    setErrors((current) => ({ ...current, order: undefined, action: undefined }));
  };

  const sendComment = async () => {
    if (!auth || !selectedRequestId || !comment.trim()) return;

    try {
      await postRequestMessage(selectedRequestId, comment.trim(), auth);
      setComment('');
      const threadData = await fetchRequestThread(selectedRequestId, auth);
      setThread(threadData.messages);
      setErrors((current) => ({ ...current, action: undefined, thread: undefined }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to post comment';
      setErrors((current) => ({ ...current, action: message }));
    }
  };

  const runTransition = async (transitionKey: string) => {
    if (!auth || !selectedRequestId) return;

    try {
      const result = await transitionRequest(selectedRequestId, transitionKey, auth);
      const latestRequests = await fetchRequests(auth);
      const threadData = await fetchRequestThread(selectedRequestId, auth);
      setRequests(latestRequests);
      setThread(threadData.messages);

      if ((result as { status?: string }).status === 'pending_approval') {
        setErrors((current) => ({ ...current, action: 'Transition sent for approval' }));
      } else {
        setErrors((current) => ({ ...current, action: undefined }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to execute transition';
      setErrors((current) => ({ ...current, action: message }));
    }
  };

  const attachService = async () => {
    if (!selectedOrderId || !selectedServiceId) return;

    try {
      const response = await assignService(selectedOrderId, selectedServiceId);
      setServiceAssignments(response.assignments);
      setSelectedServiceId('');
      setErrors((current) => ({ ...current, action: undefined }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to attach service';
      setErrors((current) => ({ ...current, action: message }));
    }
  };

  const markServiceApproved = async (serviceId: string) => {
    if (!selectedOrderId) return;

    try {
      const response = await approveService(selectedOrderId, serviceId);
      setServiceAssignments(response.assignments);
      setErrors((current) => ({ ...current, action: undefined }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to approve service';
      setErrors((current) => ({ ...current, action: message }));
    }
  };

  const uploadDocument = async () => {
    if (!newDocName.trim()) return;
    await uploadOrderDoc(newDocName.trim(), orderDetail?.order.state);
    setNewDocName('');
  };

  const renderDashboard = () => (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Open Requests</p>
          <p className="stat-value">{requests.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">RFQs</p>
          <p className="stat-value">{rfqs.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Orders</p>
          <p className="stat-value">{orders.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Notifications</p>
          <p className="stat-value">{notifications.length}</p>
        </article>
      </section>

      <section className="quick-grid">
        <article className="quick-card">
          <h3>Requests Queue</h3>
          <p>Handle customer requests, comments, and state changes.</p>
          <button className="inline-btn" onClick={() => setPage('requests')}>
            Open Requests
          </button>
        </article>
        <article className="quick-card">
          <h3>RFQ Pipeline</h3>
          <p>Track active RFQs and open full detail in one click.</p>
          <button className="inline-btn" onClick={() => setPage('rfqs')}>
            Open RFQs
          </button>
        </article>
        <article className="quick-card">
          <h3>Order Ops</h3>
          <p>Review allocations, shipments, docs, and assigned services.</p>
          <button className="inline-btn" onClick={() => setPage('orders')}>
            Open Orders
          </button>
        </article>
      </section>

      <section className="page-section">
        <div className="section-head">
          <h3 className="section-title">Recent Requests</h3>
          <button className="text-btn" onClick={() => setPage('requests')}>
            View all
          </button>
        </div>
        <div className="list-table">
          {requests.slice(0, 5).map((request) => (
            <button
              key={request.id}
              className="list-row clickable"
              onClick={() => openRequestDetail(request.id)}
            >
              <span className="badge">{request.state}</span>
              <span className="row-main">{request.title}</span>
              <span className="row-meta">{formatDate(request.created_at)}</span>
            </button>
          ))}
          {requests.length === 0 && <p className="empty-state">No requests available.</p>}
        </div>
      </section>
    </>
  );

  const renderRequestsPage = () => (
    <section className="page-section">
      <div className="section-head">
        <h3 className="section-title">All Requests</h3>
        <span className="muted">{requests.length} total</span>
      </div>
      <div className="list-table">
        {requests.map((request) => (
          <button
            key={request.id}
            className="list-row clickable"
            onClick={() => openRequestDetail(request.id)}
          >
            <span className="badge">{request.state}</span>
            <span className="row-main">{request.title}</span>
            <span className="row-meta">
              {request.priority || 'normal'} | {formatDate(request.created_at)}
            </span>
          </button>
        ))}
        {requests.length === 0 && <p className="empty-state">No requests found.</p>}
      </div>
    </section>
  );

  const renderRequestDetailPage = () => {
    if (!selectedRequest) {
      return (
        <section className="page-section">
          <p className="empty-state">Select a request from Requests page first.</p>
          <button className="inline-btn" onClick={() => setPage('requests')}>
            Back to Requests
          </button>
        </section>
      );
    }

    const canSubmit = selectedRequest.state === 'draft';
    const canStart = auth?.actor === 'internal' && selectedRequest.state === 'submitted';
    const canComplete = auth?.actor === 'internal' && selectedRequest.state === 'in_progress';

    return (
      <section className="detail-wrap">
        <div className="section-head">
          <div>
            <button className="text-btn" onClick={() => setPage('requests')}>
              Back to Requests
            </button>
            <h3 className="section-title">{selectedRequest.title}</h3>
            <p className="muted">
              State: {selectedRequest.state} | Created: {formatDateTime(selectedRequest.created_at)}
            </p>
          </div>
          <div className="action-row">
            {canSubmit && (
              <button className="inline-btn" onClick={() => runTransition('submit_request')}>
                Submit
              </button>
            )}
            {canStart && (
              <button className="inline-btn light" onClick={() => runTransition('start_processing')}>
                Start
              </button>
            )}
            {canComplete && (
              <button className="inline-btn light" onClick={() => runTransition('complete_request')}>
                Complete
              </button>
            )}
          </div>
        </div>

        {(errors.thread || errors.action) && <p className="banner-error">{errors.thread || errors.action}</p>}

        <article className="detail-card">
          <h4>Conversation</h4>
          <div className="thread-panel">
            {thread.map((message) => (
              <div
                key={message.id}
                className={`thread-item ${message.message_type === 'system_state_change' ? 'system' : ''}`}
              >
                <p>{message.body}</p>
                <span>{formatDateTime(message.created_at)}</span>
              </div>
            ))}
            {thread.length === 0 && <p className="empty-state">No thread messages yet.</p>}
          </div>

          <div className="composer">
            <input
              placeholder="Write a comment for this request"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button className="inline-btn" onClick={sendComment}>
              Send
            </button>
          </div>
        </article>
      </section>
    );
  };

  const renderRfqsPage = () => (
    <section className="page-section">
      <div className="section-head">
        <h3 className="section-title">All RFQs</h3>
        <span className="muted">{rfqs.length} total</span>
      </div>
      <div className="list-table">
        {rfqs.map((rfq) => (
          <button key={rfq.id} className="list-row clickable" onClick={() => openRfqDetail(rfq.id)}>
            <span className="badge">{rfq.state}</span>
            <span className="row-main">{rfq.rfq_number}</span>
            <span className="row-meta">{formatDate(rfq.created_at)}</span>
          </button>
        ))}
        {rfqs.length === 0 && <p className="empty-state">No RFQs found.</p>}
      </div>
    </section>
  );

  const renderRfqDetailPage = () => {
    if (!rfqDetail) {
      return (
        <section className="page-section">
          <p className="empty-state">Select an RFQ from RFQs page first.</p>
          <button className="inline-btn" onClick={() => setPage('rfqs')}>
            Back to RFQs
          </button>
        </section>
      );
    }

    return (
      <section className="detail-wrap">
        <div className="section-head">
          <div>
            <button className="text-btn" onClick={() => setPage('rfqs')}>
              Back to RFQs
            </button>
            <h3 className="section-title">{rfqDetail.rfq.rfq_number}</h3>
            <p className="muted">
              State: {rfqDetail.rfq.state} | Target ship date:{' '}
              {formatDate(rfqDetail.rfq.target_ship_date || null)}
            </p>
          </div>
        </div>

        {errors.rfq && <p className="banner-error">{errors.rfq}</p>}

        <article className="detail-card">
          <h4>RFQ Items</h4>
          <ul className="simple-list">
            {rfqDetail.items.map((item, index) => (
              <li key={`${item.sku}-${index}`}>
                <span>{item.sku}</span>
                <span>Qty: {item.qty}</span>
              </li>
            ))}
            {rfqDetail.items.length === 0 && <li>No line items available.</li>}
          </ul>
          <p className="muted">SKU count (summary): {rfqDetail.rfq.sku_count || '-'}</p>
        </article>
      </section>
    );
  };

  const renderOrdersPage = () => (
    <section className="page-section">
      <div className="section-head">
        <h3 className="section-title">All Orders</h3>
        <span className="muted">{orders.length} total</span>
      </div>
      <div className="list-table">
        {orders.map((order) => (
          <button
            key={order.id}
            className="list-row clickable"
            onClick={() => openOrderDetail(order.id)}
          >
            <span className="badge">{order.state}</span>
            <span className="row-main">{order.order_number}</span>
            <span className="row-meta">{formatDate(order.created_at)}</span>
          </button>
        ))}
        {orders.length === 0 && <p className="empty-state">No orders found.</p>}
      </div>
    </section>
  );

  const renderOrderDetailPage = () => {
    if (!orderDetail) {
      return (
        <section className="page-section">
          <p className="empty-state">Select an order from Orders page first.</p>
          <button className="inline-btn" onClick={() => setPage('orders')}>
            Back to Orders
          </button>
        </section>
      );
    }

    const docsForState = meta?.orderStates.find((state) => state.state === orderDetail.order.state)?.docs || [];
    const orderEvents = inventoryEvents.filter(
      (event) => event.order_number === orderDetail.order.order_number,
    );

    return (
      <section className="detail-wrap">
        <div className="section-head">
          <div>
            <button className="text-btn" onClick={() => setPage('orders')}>
              Back to Orders
            </button>
            <h3 className="section-title">{orderDetail.order.order_number}</h3>
            <p className="muted">
              State: {orderDetail.order.state} | Tracking: {orderDetail.order.tracking_number || '-'} |
              ETA: {formatDateTime(orderDetail.order.eta || null)}
            </p>
          </div>
        </div>

        {(errors.order || errors.action) && <p className="banner-error">{errors.order || errors.action}</p>}

        <div className="detail-grid">
          <article className="detail-card">
            <h4>Required Documents</h4>
            <ul className="simple-list">
              {docsForState.map((doc) => (
                <li key={doc}>
                  <span>{doc}</span>
                </li>
              ))}
              {docsForState.length === 0 && <li>No required documents defined.</li>}
            </ul>

            <h4>Uploaded Documents</h4>
            <ul className="simple-list">
              {orderDocs.map((doc) => (
                <li key={`${doc.name}-${doc.version || 1}`}>
                  <span>{doc.name}</span>
                  <span>
                    {doc.requiredFor} v{doc.version || 1}
                  </span>
                </li>
              ))}
              {orderDocs.length === 0 && <li>No uploaded documents yet.</li>}
            </ul>

            <div className="composer">
              <input
                placeholder="Document name"
                value={newDocName}
                onChange={(event) => setNewDocName(event.target.value)}
                disabled={docsLoading}
              />
              <button className="inline-btn" onClick={uploadDocument} disabled={docsLoading}>
                Upload
              </button>
            </div>
            {docError && <p className="banner-error">{docError}</p>}
          </article>

          <article className="detail-card">
            <h4>Service Assignments</h4>
            <ul className="simple-list">
              {serviceAssignments.map((assignment) => (
                <li key={assignment.serviceId}>
                  <span>
                    {services.find((service) => service.id === assignment.serviceId)?.name ||
                      assignment.serviceId}
                  </span>
                  <span>
                    {assignment.status}
                    {auth?.actor === 'internal' && assignment.status !== 'approved' && (
                      <button
                        className="text-btn inline-text"
                        onClick={() => markServiceApproved(assignment.serviceId)}
                      >
                        Approve
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {serviceAssignments.length === 0 && <li>No services assigned yet.</li>}
            </ul>

            <div className="composer">
              <select
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
              >
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.attachTo})
                  </option>
                ))}
              </select>
              <button className="inline-btn" onClick={attachService}>
                Attach
              </button>
            </div>

            <h4>Allocations</h4>
            <ul className="simple-list">
              {orderDetail.allocations.map((allocation) => (
                <li key={allocation.lot}>
                  <span>{allocation.lot}</span>
                  <span>
                    {allocation.status} | Qty {allocation.qty}
                  </span>
                </li>
              ))}
              {orderDetail.allocations.length === 0 && <li>No allocations.</li>}
            </ul>

            <h4>Shipments</h4>
            <ul className="simple-list">
              {orderDetail.shipments.map((shipment, index) => (
                <li key={`${shipment.tracking}-${index}`}>
                  <span>{shipment.carrier}</span>
                  <span>
                    {shipment.tracking} | ETA {formatDateTime(shipment.eta)}
                  </span>
                </li>
              ))}
              {orderDetail.shipments.length === 0 && <li>No shipment records.</li>}
            </ul>

            <h4>Inventory Events</h4>
            <ul className="simple-list">
              {orderEvents.map((event, index) => (
                <li key={`${event.ts}-${index}`}>
                  <span>{event.type}</span>
                  <span>{event.detail}</span>
                </li>
              ))}
              {orderEvents.length === 0 && <li>No related events.</li>}
            </ul>
          </article>
        </div>
      </section>
    );
  };

  const renderNotificationsPage = () => (
    <section className="page-section">
      <div className="section-head">
        <h3 className="section-title">Notifications</h3>
        <span className="muted">{notifications.length} events</span>
      </div>
      <div className="list-table">
        {notifications.map((notification) => (
          <article key={notification.id} className="list-row">
            <span className="badge">{notification.event_type}</span>
            <span className="row-main">
              {notification.payload?.rfq_number ||
                notification.payload?.order_number ||
                notification.payload?.request_title ||
                'Workflow event'}
            </span>
            <span className="row-meta">{formatDateTime(notification.created_at)}</span>
          </article>
        ))}
        {notifications.length === 0 && <p className="empty-state">No notifications available.</p>}
      </div>
    </section>
  );

  const renderCurrentPage = () => {
    switch (page) {
      case 'dashboard':
        return renderDashboard();
      case 'requests':
        return renderRequestsPage();
      case 'request-detail':
        return renderRequestDetailPage();
      case 'rfqs':
        return renderRfqsPage();
      case 'rfq-detail':
        return renderRfqDetailPage();
      case 'orders':
        return renderOrdersPage();
      case 'order-detail':
        return renderOrderDetailPage();
      case 'notifications':
        return renderNotificationsPage();
      default:
        return renderDashboard();
    }
  };

  if (!auth) {
    return (
      <div className="login-shell">
        <section className="login-brand">
          <img src={logo} alt="Babylon" />
          <p className="brand-tag">Babylon CRM</p>
          <h1>Simple workspace for requests, RFQs, and order operations.</h1>
          <p>Choose one demo profile and start working with a clean page-by-page CRM flow.</p>
        </section>

        <section className="login-panel">
          <h2>Sign in</h2>
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="text-input"
            value={loginForm.email}
            onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="alice@babylon.internal or bob@acme.com"
          />

          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="text-input"
            type="password"
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((current) => ({ ...current, password: event.target.value }))
            }
            placeholder="Enter password"
          />

          <div className="login-presets">
            <button
              className="preset-btn"
              onClick={() =>
                setLoginForm({
                  email: USER_PRESETS.internal.email,
                  password: USER_PRESETS.internal.password,
                })
              }
            >
              Use Internal User
            </button>
            <button
              className="preset-btn"
              onClick={() =>
                setLoginForm({
                  email: USER_PRESETS.customer.email,
                  password: USER_PRESETS.customer.password,
                })
              }
            >
              Use Customer User
            </button>
          </div>

          {loginError && <p className="login-error">{loginError}</p>}

          <button className="primary-btn" onClick={handleLogin}>
            Open CRM
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="crm-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src={logo} alt="Babylon" />
          <p>Babylon CRM</p>
        </div>

        <nav className="nav-group">
          <button
            className={`nav-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${activeNav === 'requests' ? 'active' : ''}`}
            onClick={() => setPage('requests')}
          >
            Requests
          </button>
          <button
            className={`nav-btn ${activeNav === 'rfqs' ? 'active' : ''}`}
            onClick={() => setPage('rfqs')}
          >
            RFQs
          </button>
          <button
            className={`nav-btn ${activeNav === 'orders' ? 'active' : ''}`}
            onClick={() => setPage('orders')}
          >
            Orders
          </button>
          <button
            className={`nav-btn ${activeNav === 'notifications' ? 'active' : ''}`}
            onClick={() => setPage('notifications')}
          >
            Notifications
          </button>
        </nav>

        <div className="sidebar-footer">
          <p className="chip">Tenant: {auth.customerId}</p>
          <p className="chip">Membership: {auth.membershipId}</p>

          <div className="actor-toggle">
            <button
              className={`actor-btn ${auth.actor === 'customer' ? 'active' : ''}`}
              onClick={() => switchActor('customer')}
            >
              Customer View
            </button>
            <button
              className={`actor-btn ${auth.actor === 'internal' ? 'active' : ''}`}
              onClick={() => switchActor('internal')}
            >
              Internal View
            </button>
          </div>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content-area">
        <header className="topbar">
          <div>
            <h2 className="page-title">{getPageLabel(page)}</h2>
            <p className="page-subtitle">
              Signed in as {auth.name} ({auth.email})
            </p>
          </div>
          <div className="topbar-right">
            {isLoading && <span className="muted">Refreshing data...</span>}
            <button className="inline-btn light" onClick={() => void loadWorkspace(auth)}>
              Refresh
            </button>
          </div>
        </header>

        {errors.load && <p className="banner-error">{errors.load}</p>}

        {renderCurrentPage()}
      </main>
    </div>
  );
}

export default App;
