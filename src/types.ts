export interface Item {
  id: number;
  name: string;
  category: string;
  min_level: number;
  is_core: boolean;
  unit: string;
}

export type StockStatus = 'enough' | 'low' | 'critical';

export interface DailyCheck {
  id?: number;
  item_id: number;
  name?: string;
  category?: string;
  status: StockStatus;
  quantity_needed: number;
  is_urgent: boolean;
  date: string;
  staff_name: string;
  unit?: string;
}

export interface Purchase {
  id: number;
  date: string;
  item_id: number;
  name: string;
  quantity: number;
  cost: number;
  store: string;
  purchased_at: string;
}

export interface WeeklyStat {
  items: {
    name: string;
    total_quantity: number;
    total_cost: number;
  }[];
  stores: {
    store: string;
    total_cost: number;
  }[];
}
