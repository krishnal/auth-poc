import { useState, useEffect } from 'react';
import { apiClient } from '../services/api-client';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(endpoint: string, dependencies: any[] = []) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const response = await apiClient.get<T>(endpoint);
        
        if (isMounted) {
          setState({
            data: response.data,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : 'An error occurred',
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  const refetch = () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    // Re-trigger the effect by updating a dependency
  };

  return { ...state, refetch };
}