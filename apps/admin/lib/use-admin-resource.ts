'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminRequest, errorMessage } from './api-client';

export function useAdminResource<T>(path: string, initial: T) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminRequest<T>(path));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, load };
}
