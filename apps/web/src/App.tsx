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
  type RequestItem,
  type ThreadMessage,
  type RfqItem,
  type OrderItem,
  type NotificationItem,
  type OrderDetail,
} from './api';

type Actor = 'customer' | 'internal';

type AuthCtx = {
  customerId: string;
  membershipId: string;
};

function useAuth(actor: Actor): AuthCtx {
  const customerId = import.meta.env.VITE_CUSTOMER_ID as string;
  const customerMembership = import.meta.env.VITE_MEMBERSHIP_ID as string;
  const internalMembership = (import.meta.env.VITE_INTERNAL_MEMBERSHIP_ID as string | undefined) || customerMembership;

  return useMemo(() => ({
    customerId,
    membershipId: actor === 'internal' ? internalMembership : customerMembership,
  }), [actor, customerId, customerMembership, internalMembership]);
}

function App() {
  const [actor, setActor] = useState<Actor>('customer');
  const auth = useAuth(actor);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [rfqs, setRfqs] = useState<RfqItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [rfqDetail, setRfqDetail] = useState<{ rfq: RfqItem; items: { sku: string; qty: number }[] } | null>(null);

  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{ load?: string; thread?: string; rfq?: string; order?: string }>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [reqs, rfqData, orderData, notifData] = await Promise.all([
          fetchRequests(auth),
          fetchRfqs(auth),
          fetchOrders(auth),
          fetchNotifications(auth),
        ]);
        setRequests(reqs);
        setRfqs(rfqData);
        setOrders(orderData);
        setNotifications(notifData);

        if (reqs.length) {
          const first = reqs[0].id;
          setSelectedRequestId(first);
          const t = await fetchRequestThread(first, auth);
          setThread(t.messages);
        }
        if (orderData.length) {
          const first = orderData[0].id;
          setSelectedOrderId(first);
          setOrderDetail(await fetchOrderDetail(first, auth));
        }
        if (rfqData.length) {
          const first = rfqData[0].id;
          setSelectedRfqId(first);
          setRfqDetail(await fetchRfqDetail(first, auth));
        }
      } catch (e: any) {
        setErrors({ load: e.message });
      }
    };
    load();
  }, [auth]);

  const selectRequest = async (id: string) => {
    setSelectedRequestId(id);
    try {
      const t = await fetchRequestThread(id, auth);
      setThread(t.messages);
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, thread: e.message }));
    }
  };

  const sendComment = async () => {
    if (!selectedRequestId || !comment.trim()) return;
    await postRequestMessage(selectedRequestId, comment.trim(), auth);
    setComment('');
    const t = await fetchRequestThread(selectedRequestId, auth);
    setThread(t.messages);
  };

  const doTransition = async (key: string) => {
    if (!selectedRequestId) return;
    await transitionRequest(selectedRequestId, key, auth);
    const reqs = await fetchRequests(auth);
    setRequests(reqs);
    const t = await fetchRequestThread(selectedRequestId, auth);
    setThread(t.messages);
  };

  const selectOrder = async (id: string) => {
    setSelectedOrderId(id);
    try {
      const detail = await fetchOrderDetail(id, auth);
      setOrderDetail(detail);
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, order: e.message }));
    }
  };

  const selectRfq = async (id: string) => {
    setSelectedRfqId(id);
    try {
      const detail = await fetchRfqDetail(id, auth);
      setRfqDetail(detail);
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, rfq: e.message }));
    }
  };

  const stats = [
    { label: 'Requests', value: requests.length },
    { label: 'RFQs', value: rfqs.length },
    { label: 'Orders', value: orders.length },
    { label: 'Notifications', value: notifications.length },
  ];

  const selectedRequest = selectedRequestId ? requests.find(r => r.id === selectedRequestId) : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo-block">
          <img src={logo} alt="Babylon" />
          <p className="eyebrow">Babylon Portal</p>
        </div>
        <div className="actor-switch">
          <p>View</p>
          <div className="switch">
            <button className={actor === 'customer' ? 'active' : ''} onClick={() => setActor('customer')}>Customer</button>
            <button className={actor === 'internal' ? 'active' : ''} onClick={() => setActor('internal')}>Babylon</button>
          </div>
          <small className="muted">Controls which actions are enabled</small>
        </div>
        <div className="mini-card">
          <p className="muted small">Customer ID</p>
          <p className="code">{auth.customerId}</p>
          <p className="muted small">Membership ID</p>
          <p className="code">{auth.membershipId}</p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>CRM Ops Console</h1>
            <p className="muted">Dual-side workflow, messaging, documents, and notifications.</p>
          </div>
          <div className="badges">
            <span className="pill bold">Tenant isolation</span>
            <span className="pill">Workflow driven</span>
          </div>
        </header>

        {errors.load && <div className="error">{errors.load}</div>}

        <section className="stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="card stat">
              <p className="stat-value">{s.value}</p>
              <p className="muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="grid two">
          <div className="card">
            <div className="section-head">
              <h2>Requests</h2>
              <span className="muted">Live</span>
            </div>
            <div className="list">
              {requests.map((r) => (
                <button
                  key={r.id}
                  className={`row-btn ${selectedRequestId === r.id ? 'active' : ''}`}
                  onClick={() => selectRequest(r.id)}
                >
                  <div className="pill small">{r.state}</div>
                  <div className="row-body">
                    <div className="req-title">{r.title}</div>
                    <div className="req-meta">
                      <span>{r.priority || 'normal'}</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))}
              {requests.length === 0 && <p className="muted">No requests yet.</p>}
            </div>
          </div>

          <div className="card">
            <div className="section-head">
              <h2>Thread</h2>
              <div className="actions">
                <button onClick={() => doTransition('submit_request')}>Submit</button>
                {actor === 'internal' && (
                  <>
                    <button className="ghost" onClick={() => doTransition('start_processing')}>Start</button>
                    <button className="ghost" onClick={() => doTransition('complete_request')}>Complete</button>
                  </>
                )}
              </div>
            </div>
            {selectedRequest && (
              <div className="req-detail">
                <span className="pill tiny">{selectedRequest.state}</span>
                <span className="muted tiny">Category: {selectedRequest.category || '-'}</span>
                <span className="muted tiny">Created: {new Date(selectedRequest.created_at).toLocaleString()}</span>
              </div>
            )}
            <div className="thread">
              {thread.map((m) => (
                <div key={m.id} className={`bubble ${m.message_type === 'system_state_change' ? 'system' : 'customer'}`}>
                  {m.body}
                  <div className="muted tiny">{new Date(m.created_at).toLocaleString()}</div>
                </div>
              ))}
              {thread.length === 0 && <p className="muted">Select a request to view thread.</p>}
            </div>
            <div className="composer">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." />
              <button onClick={sendComment}>Send</button>
            </div>
          </div>
        </section>

        <section className="grid three">
          <div className="card">
            <div className="section-head">
              <h3>RFQs</h3>
              <span className="muted">API</span>
            </div>
            <div className="list small">
              {rfqs.map((r) => (
                <button key={r.id} className={`row-line btn-line ${selectedRfqId === r.id ? 'active' : ''}`} onClick={() => selectRfq(r.id)}>
                  <span className="pill tiny">{r.state}</span>
                  <div className="req-title">{r.rfq_number}</div>
                  <span className="muted tiny">{new Date(r.created_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
            {rfqDetail && (
              <div className="order-detail">
                <p className="muted tiny">Target ship: {rfqDetail.rfq.target_ship_date ? new Date(rfqDetail.rfq.target_ship_date).toLocaleDateString() : '-'}</p>
                <p className="muted tiny">SKU count: {rfqDetail.rfq.sku_count || '-'}</p>
                <div className="muted tiny">Items:</div>
                <ul className="mini-list">
                  {rfqDetail.items.map((i, idx) => (
                    <li key={idx}>{i.sku} - {i.qty}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-head">
              <h3>Orders</h3>
              <span className="muted">API</span>
            </div>
            <div className="list small">
              {orders.map((o) => (
                <button key={o.id} className={`row-line btn-line ${selectedOrderId === o.id ? 'active' : ''}`} onClick={() => selectOrder(o.id)}>
                  <span className="pill tiny">{o.state}</span>
                  <div className="req-title">{o.order_number}</div>
                  <span className="muted tiny">{new Date(o.created_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
            {orderDetail && (
              <div className="order-detail">
                <p className="muted tiny">Batch: {orderDetail.order.batch_number || '-'}</p>
                <p className="muted tiny">Tracking: {orderDetail.order.tracking_number || '-'}</p>
                <p className="muted tiny">ETA: {orderDetail.order.eta ? new Date(orderDetail.order.eta).toLocaleString() : '-'}</p>
                <div className="muted tiny">Allocations:</div>
                <ul className="mini-list">
                  {orderDetail.allocations.map((a) => (
                    <li key={a.lot}>{a.lot} - {a.status} - {a.qty}</li>
                  ))}
                </ul>
                <div className="muted tiny">Shipments:</div>
                <ul className="mini-list">
                  {orderDetail.shipments.map((s, idx) => (
                    <li key={idx}>{s.carrier} - {s.tracking} - {s.eta ? new Date(s.eta).toLocaleString() : '-'}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-head">
              <h3>Notifications</h3>
              <span className="muted">Outbox</span>
            </div>
            <div className="list small">
              {notifications.map((n) => (
                <div key={n.id} className="row-line">
                  <span className="pill tiny">{n.event_type}</span>
                  <div className="req-title">
                    {n.payload?.rfq_number || n.payload?.order_number || n.payload?.request_title || 'Event'}
                  </div>
                  <span className="muted tiny">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))}
              {notifications.length === 0 && <p className="muted">No notifications.</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
