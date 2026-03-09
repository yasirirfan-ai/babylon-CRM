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
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      throw new Error(parsed.error || parsed.message || res.statusText);
    } catch {
      throw new Error(text || res.statusText);
    }
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

export async function fetchMeta() {
  return request<{
    orderStates: { state: string; docs: string[]; notes: string }[];
    requestStates: string[];
  }>('/meta/order-states').then((o) =>
    request<{ requestStates: string[] }>('/meta/request-states').then((r) => ({
      orderStates: (o as any).orderStates,
      requestStates: r.requestStates,
    }))
  );
}

export async function fetchCatalog() {
  return request<{ brands: { id: string; name: string; skus: { id: string; name: string; moq: number; revisions: { id: string; version: string; status: string; updated_at: string }[] }[] }[] }>('/demo/catalog');
}

export async function fetchServices() {
  return request<{ services: { id: string; name: string; attachTo: string; chargeable: boolean; status: string }[] }>('/demo/services');
}

export async function fetchRd() {
  return request<{ rdRequests: { id: string; title: string; state: string; owner: string; customer_visible: boolean }[] }>('/demo/rd');
}

export async function fetchOrderDocuments(orderId: string) {
  return request<{ documents: { name: string; requiredFor: string; link?: string }[] }>(`/demo/documents/order/${orderId}`);
}

export async function uploadOrderDocument(orderId: string, name: string, requiredFor?: string) {
  return request<{ documents: { name: string; requiredFor: string; link?: string; version: number }[] }>(`/demo/documents/order/${orderId}`, {
    method: 'POST',
    body: { name, requiredFor },
  });
}

export async function fetchServiceAssignments(entityId: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/demo/services/assignments/${entityId}`);
}

export async function assignService(entityId: string, serviceId: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/demo/services/assign`, {
    method: 'POST',
    body: { entityId, serviceId },
  });
}

export async function approveService(entityId: string, serviceId: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/demo/services/approve`, {
    method: 'POST',
    body: { entityId, serviceId },
  });
}

export async function advanceRd(id: string) {
  return request<{ rd: any }>(`/demo/rd/${id}/advance`, { method: 'POST' });
}

export async function fetchInventoryEvents() {
  return request<{ events: { ts: string; type: string; order_number: string; detail: string }[] }>(`/demo/inventory/events`);
}
