// Default to /api in prod (Vercel rewrite) and localhost:3000/api in dev.
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
const DEFAULT_CUSTOMER_ID = import.meta.env.VITE_CUSTOMER_ID || 'demo-customer';
const DEFAULT_MEMBERSHIP_ID = import.meta.env.VITE_MEMBERSHIP_ID || 'demo-membership';

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  method?: HttpMethod;
  body?: any;
  membershipId?: string;
  customerId?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-id': options.customerId || DEFAULT_CUSTOMER_ID,
      'x-membership-id': options.membershipId || DEFAULT_MEMBERSHIP_ID,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export interface RequestItem {
  id: string;
  state: string;
  title: string;
  priority: string | null;
  created_at: string;
  category?: string | null;
}

export async function fetchRequests(m?: { membershipId?: string; customerId?: string }): Promise<RequestItem[]> {
  const data = await request<{ requests: RequestItem[] }>('/requests', m);
  return data.requests;
}

export interface ThreadMessage {
  id: string;
  message_type: string;
  body: string;
  created_at: string;
}

export interface ThreadResponse {
  thread: { id: string } | null;
  messages: ThreadMessage[];
}

export async function fetchRequestThread(id: string, m?: { membershipId?: string; customerId?: string }): Promise<ThreadResponse> {
  return request(`/requests/${id}/thread`, m);
}

export async function postRequestMessage(id: string, body: string, m?: { membershipId?: string; customerId?: string }) {
  return request(`/requests/${id}/messages`, {
    method: 'POST',
    body: { body },
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function transitionRequest(id: string, transitionKey: string, m?: { membershipId?: string; customerId?: string }, payload?: unknown) {
  return request(`/requests/${id}/transition`, {
    method: 'POST',
    body: {
      transitionKey,
      payload,
    },
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export interface RfqItem {
  id: string;
  rfq_number: string;
  state: string;
  created_at: string;
  target_ship_date?: string | null;
  sku_count?: string | null;
}

export interface OrderItem {
  id: string;
  order_number: string;
  state: string;
  created_at: string;
}

export async function fetchRfqs(m?: { membershipId?: string; customerId?: string }): Promise<RfqItem[]> {
  const data = await request<{ rfqs: RfqItem[] }>('/rfqs', m);
  return data.rfqs;
}

export async function fetchRfqDetail(id: string, m?: { membershipId?: string; customerId?: string }): Promise<{ rfq: RfqItem; items: { sku: string; qty: number }[] }> {
  return request(`/rfqs/${id}`, m);
}

export async function fetchOrders(m?: { membershipId?: string; customerId?: string }): Promise<OrderItem[]> {
  const data = await request<{ orders: OrderItem[] }>('/orders', m);
  return data.orders;
}

export interface OrderDetail {
  order: OrderItem & { tracking_number?: string | null; batch_number?: string | null; eta?: string | null };
  allocations: { lot: string; status: string; qty: number }[];
  shipments: { carrier: string; tracking: string; eta: string | null }[];
}

export async function fetchOrderDetail(id: string, m?: { membershipId?: string; customerId?: string }): Promise<OrderDetail> {
  return request(`/orders/${id}`, m);
}

export interface NotificationItem {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

export async function fetchNotifications(m?: { membershipId?: string; customerId?: string }): Promise<NotificationItem[]> {
  const data = await request<{ notifications: NotificationItem[] }>('/notifications', m);
  return data.notifications;
}
