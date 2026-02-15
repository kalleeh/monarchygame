export interface Territory {
  id: string;
  name: string;
  coordinates: {
    x?: number;
    y?: number;
  };
  fortifications?: number;
}
