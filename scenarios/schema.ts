export interface PlayerConfig {
  id: string;
  x: number;
  y: number;
  role: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  seed?: number;
  players: PlayerConfig[];
}
