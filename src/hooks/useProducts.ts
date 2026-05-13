import { useEffect, useState, useCallback } from 'react';
import type { Product } from '../types/product';
import { listProducts } from '../lib/products';

export function useProducts(opts?: { includeInactive?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const includeInactive = opts?.includeInactive ?? false;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProducts({ includeInactive });
      setProducts(data);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { products, loading, error, refresh };
}
