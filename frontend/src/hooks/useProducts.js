import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '../api/client';

export function useProducts(initialParams = {}) {
  const [products,   setProducts]   = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [params,     setParams]     = useState({ page: 1, limit: 50, ...initialParams });

  const fetchProducts = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const merged = { ...params, ...overrides };
      const { data } = await productsApi.list(merged);
      setProducts(data.products);
      setTotal(data.total);
      setParams(merged);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchProducts(); }, []); // eslint-disable-line

  return { products, total, loading, error, params, fetchProducts, setParams };
}
