export interface TrainedUnit {
  id: string;
  type: string;
  level: number;
  quantity?: number;
}

export interface TrainingQueueItem {
  id: string;
  type: string;
  progress: number;
  unitType?: string;
  quantity?: number;
}

export interface TrainableUnit {
  id: string;
  type: string;
  cost: number;
  time: number;
}
