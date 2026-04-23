import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { TokenData } from '../types';

export function useTokens(days: number = 7) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTokens = useCallback(async () => {
    try {
      const data = await api.getTokens(days);
      setTokenData(data);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      setTokenData({ 
        available: false, 
        summary: { input: 0, cached: 0, output: 0, reasoning: 0, total: 0 }, 
        daily: [], 
        models: [], 
        sources: [], 
        error: true 
      });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    setLoading(true);
    loadTokens();

    const interval = setInterval(loadTokens, 30000);
    return () => clearInterval(interval);
  }, [loadTokens]);

  return { tokenData, loading };
}
