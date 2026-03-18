// Default to /api in prod (Vercel rewrite) and localhost:3000/api in dev.
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
const DEFAULT_CUSTOMER_ID = import.meta.env.VITE_CUSTOMER_ID || 'demo-customer';
const DEFAULT_MEMBERSHIP_ID = import.meta.env.VITE_MEMBERSHIP_ID || 'demo-membership';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error || parsed.message || message;
    } catch { }
    throw new Error(message);
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
  description?: string | null;
  deadline?: string | null;
  product_id?: string | null;
  metadata?: any;
}

export async function fetchRequests(m?: { membershipId?: string; customerId?: string }): Promise<RequestItem[]> {
  const data = await request<{ requests: RequestItem[] }>('/requests', m);
  return data.requests;
}

export async function createRequest(payload: { title: string; description?: string; category?: string; subcategory?: string; deadline?: string; metadata?: any }, m?: { membershipId?: string; customerId?: string }): Promise<RequestItem> {
  const data = await request<{ request: RequestItem }>('/requests', {
    method: 'POST',
    body: payload,
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
  return data.request;
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

export async function transitionRequest(id: string, transitionKey: string, payload?: unknown, m?: { membershipId?: string; customerId?: string }) {
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

export async function deleteRequest(id: string, m?: { membershipId?: string; customerId?: string }) {
  return request(`/requests/${id}`, {
    method: 'DELETE',
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function trackShipment(orderId: string, m?: { membershipId?: string; customerId?: string }): Promise<{ tracking: any }> {
  return request<{ tracking: any }>(`/logistics/track/${orderId}`, m);
}

export interface DocumentItem {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export async function fetchRequestDocuments(requestId: string, m?: { membershipId?: string; customerId?: string }): Promise<DocumentItem[]> {
  const data = await request<{ documents: DocumentItem[] }>(`/documents/request/${requestId}`, m);
  return data.documents;
}

export async function uploadRequestDocument(requestId: string, file: File, m?: { membershipId?: string; customerId?: string }): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/documents/request/${requestId}`, {
    method: 'POST',
    body: formData,
    headers: {
      'x-customer-id': m?.customerId || DEFAULT_CUSTOMER_ID,
      'x-membership-id': m?.membershipId || DEFAULT_MEMBERSHIP_ID,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to upload document');
  }

  const data = await res.json();
  return data.document;
}

export async function deleteRequestDocument(docId: string, m?: { membershipId?: string; customerId?: string }): Promise<void> {
  await request(`/documents/request/${docId}`, {
    method: 'DELETE',
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export interface BrandItem {
  id: string;
  name: string;
  logo_url: string | null;
  theme_config: any | null;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
}

export interface RfqItem {
  id: string;
  rfq_number: string;
  state: string;
  negotiation_status: string;
  notes?: string | null;
  created_at: string;
  target_ship_date?: string | null;
  sku_count?: string | null;
  product_id?: string | null;
  product?: ProductItem | null;
  brand?: BrandItem | null;
}

export interface OrderItem {
  id: string;
  order_number: string;
  state: string;
  tracking_number?: string | null;
  batch_number?: string | null;
  eta?: string | null;
  expedite_fee?: string | null;
  carrier_status?: string | null;
  created_at: string;
}

export async function fetchRfqs(m?: { membershipId?: string; customerId?: string }): Promise<RfqItem[]> {
  const data = await request<{ rfqs: { rfq: RfqItem; product: ProductItem | null; brand: BrandItem | null }[] }>('/rfqs', m);
  return data.rfqs.map(item => ({
    ...item.rfq,
    product: item.product,
    brand: item.brand,
  }));
}

export async function fetchRfqDetail(id: string, m?: { membershipId?: string; customerId?: string }): Promise<{ rfq: RfqItem; product: ProductItem | null; brand: BrandItem | null; items: { id: string; quantity: string; target_price: string; agreed_price: string; product: ProductItem }[] }> {
  return request(`/rfqs/${id}`, m);
}

export async function negotiateRfq(id: string, notes: string, m?: { membershipId?: string; customerId?: string }) {
  return request(`/rfqs/${id}/negotiate`, {
    method: 'POST',
    body: { notes },
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function approveRfqQuotation(id: string, m?: { membershipId?: string; customerId?: string }) {
  return request(`/rfqs/${id}/approve-quotation`, {
    method: 'POST',
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function fetchOrders(m?: { membershipId?: string; customerId?: string }): Promise<OrderItem[]> {
  const data = await request<{ orders: OrderItem[] }>('/orders', m);
  return data.orders;
}

export interface OrderDetail {
  order: OrderItem;
  items: { id: string; quantity: string; unit_price: string; product: ProductItem }[];
  allocations: { id: string; lot_number: string; status: string; quantity: string }[];
  production_logs: { id: string; stage: string; status: string; notes: string; created_at: string }[];
  shipments?: { carrier: string; tracking: string; eta: string | null }[];
}

export async function fetchOrderDetail(id: string, m?: { membershipId?: string; customerId?: string }): Promise<OrderDetail> {
  return request(`/orders/${id}`, m);
}

export async function requestOrderModification(id: string, changes: any, m?: { membershipId?: string; customerId?: string }) {
  return request(`/orders/${id}/request-modification`, {
    method: 'POST',
    body: { changes },
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export interface NotificationItem {
  id: string;
  event_type: string;
  payload: any;
  is_read?: boolean;
  created_at: string;
}

export async function fetchNotifications(m?: { membershipId?: string; customerId?: string }): Promise<NotificationItem[]> {
  const data = await request<{ notifications: NotificationItem[] }>('/notifications', m);
  return data.notifications;
}

export async function markNotificationsRead(m?: { membershipId?: string; customerId?: string }): Promise<void> {
  await request('/notifications/read', {
    method: 'PUT',
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function fetchMeta() {
  const [o, r, b] = await Promise.all([
    request<{ orderStates: { state: string; docs: string[]; notes: string }[] }>('/meta/order-states'),
    request<{ requestStates: string[] }>('/meta/request-states'),
    request<{ branding: { name: string; logo_url: string; theme_config: any } | null }>('/meta/branding'),
  ]);

  return {
    orderStates: o.orderStates,
    requestStates: r.requestStates,
    branding: b.branding,
  };
}

export async function fetchCatalog() {
  return request<{ brands: { id: string; name: string; skus: { id: string; name: string; moq: number; revisions: { id: string; version: string; status: string; updated_at: string }[] }[] }[] }>('/demo/catalog');
}

export async function fetchServices() {
  return request<{ services: { id: string; name: string; attachTo: string; chargeable: boolean; status: string }[] }>('/services');
}

export async function fetchRd() {
  return request<{ rdRequests: { id: string; title: string; state: string; owner: string; customer_visible: boolean }[] }>('/rd');
}

export async function fetchOrderDocuments(orderId: string, m?: { membershipId?: string; customerId?: string }): Promise<DocumentItem[]> {
  const data = await request<{ documents: DocumentItem[] }>(`/documents/order/${orderId}`, m);
  return data.documents;
}

export async function uploadOrderDocument(orderId: string, file: File, m?: { membershipId?: string; customerId?: string }): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/documents/order/${orderId}`, {
    method: 'POST',
    body: formData,
    headers: {
      'x-customer-id': m?.customerId || DEFAULT_CUSTOMER_ID,
      'x-membership-id': m?.membershipId || DEFAULT_MEMBERSHIP_ID,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to upload document');
  }

  const data = await res.json();
  return data.document;
}

export async function deleteOrderDocument(docId: string, m?: { membershipId?: string; customerId?: string }): Promise<void> {
  await request(`/documents/order/${docId}`, {
    method: 'DELETE',
    membershipId: m?.membershipId,
    customerId: m?.customerId,
  });
}

export async function fetchServiceAssignments(entityId: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/services/assignments/${entityId}`);
}

export async function assignService(entityId: string, serviceId: string, entityType: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/services/assign`, {
    method: 'POST',
    body: { entityId, serviceId, entityType },
  });
}

export async function approveService(entityId: string, serviceId: string) {
  return request<{ assignments: { serviceId: string; status: string }[] }>(`/services/approve`, {
    method: 'POST',
    body: { entityId, serviceId },
  });
}

export async function advanceRd(id: string) {
  return request<{ rd: any }>(`/rd/${id}/advance`, { method: 'POST' });
}

export async function fetchProductFormula(productId: string) {
  return request<{ formulas: { id: string; version: string; formula_json: any; status: string }[] }>(`/rd/${productId}/formula`);
}

export async function fetchRequestFeedback(requestId: string) {
  return request<{ feedback: { id: string; feedback_text: string; rating: string; created_at: string }[] }>(`/rd/${requestId}/feedback`);
}

export async function postPrototypeFeedback(requestId: string, text: string, rating: string) {
  return request(`/rd/${requestId}/feedback`, {
    method: 'POST',
    body: { feedback_text: text, rating },
  });
}

export async function fetchInventoryEvents() {
  return request<{ events: { ts: string; type: string; order_number: string; detail: string }[] }>(`/demo/inventory/events`);
}
