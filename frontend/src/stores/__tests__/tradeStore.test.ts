// Trade Store Tests - Context7 minimal approach
import { describe, it, expect } from 'vitest';
import { useTradeStore } from '../tradeStore';

describe('TradeStore', () => {
  it('initializes with default state', () => {
    const store = useTradeStore.getState();
    expect(store.resources).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
  });

  it('can select a resource', () => {
    const store = useTradeStore.getState();
    const mockResource = { id: '1', name: 'Gold', quantity: 100, value: 50, supply: 200, demand: 150, type: 'precious', currentPrice: 25, basePrice: 20 };
    
    // Add resource first
    useTradeStore.setState({ resources: [mockResource] });
    
    // Select resource
    store.selectResource('1');
    
    const updatedStore = useTradeStore.getState();
    expect(updatedStore.selectedResource?.id).toBe('1');
  });

  it('can clear errors', () => {
    useTradeStore.setState({ error: 'Test error' });
    
    const store = useTradeStore.getState();
    store.clearError();
    
    const updatedStore = useTradeStore.getState();
    expect(updatedStore.error).toBe(null);
  });
});
