// API response type definitions - Context7 minimal approach
export interface ApiResponse<T = unknown> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface SpellCastResponse {
  success: boolean;
  result: {
    damage?: number;
    effect?: string;
    duration?: number;
  };
  timestamp: number;
}

export interface DiplomacyResponse<T = unknown> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface TrainingResponse {
  success: boolean;
  queueItem: {
    id: string;
    unitType: string;
    quantity: number;
    completionTime: number;
  };
}

export interface CreateOfferRequest {
  resourceId: string;
  quantity: number;
  price: number;
  type: 'buy' | 'sell';
  kingdomId: string;
}
