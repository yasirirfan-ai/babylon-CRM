import { useState, useCallback } from 'react';
import { uploadOrderDocument, fetchOrderDocuments, deleteOrderDocument, type DocumentItem } from '../api';

export function useOrderDocuments(orderId: string | null) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const resp = await fetchOrderDocuments(orderId);
      setDocs(resp);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const upload = useCallback(async (file: File) => {
    if (!orderId) return;
    setLoading(true);
    try {
      await uploadOrderDocument(orderId, file);
      const resp = await fetchOrderDocuments(orderId);
      setDocs(resp);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const remove = useCallback(async (docId: string) => {
    setLoading(true);
    try {
      await deleteOrderDocument(docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { docs, setDocs, loading, error, load, upload, remove };
}
