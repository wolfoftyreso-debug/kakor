// Snapshot och sena ändringar – JSON som lagras på DeliveryWeek.
// Live ordrar dupliceras inte i egna tabeller; snapshoten är den låsta
// kopian som alltid kan återskapas även om ordern senare ändras.

export interface SnapshotItem {
  productId: string | null;
  productName: string;
  qty: number;
  unit: string;
  grams: number;
}

export interface SnapshotStop {
  orderId: string;
  orderNumber: string;
  companyName: string;
  orgNumber: string;
  contactName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryPostalCode: string;
  deliveryCity: string;
  deliveryInstruction: string;
  reference: string;
  subscriptionNumber: string | null;
  invoiceStatus: string | null;
  invoiceNumber: string | null;
  items: SnapshotItem[];
  totalGrams: number;
}

export interface SnapshotProductTotal {
  productId: string | null;
  name: string;
  unit: string;
  qty: number;
  grams: number;
  physicalGrams: number;
  productionNeedGrams: number;
}

export interface DeliverySnapshot {
  version: 1;
  lockedAt: string;
  lockedBy: string;
  deliveryDate: string;
  isoYear: number;
  isoWeek: number;
  orderCount: number;
  totalGrams: number;
  stops: SnapshotStop[];
  byProduct: SnapshotProductTotal[];
}

export interface LateChange {
  id: string;
  at: string;
  actor: string;
  reason: string;
  type: "ORDER_ADDED" | "ORDER_REMOVED" | "ORDER_CHANGED" | "NOTE";
  orderId?: string;
  orderNumber?: string;
  detail: string;
}

export interface OpsSettings {
  cutoffWeekday: number;
  cutoffHour: number;
  opsEmail: string;
}

export const DEFAULT_OPS_SETTINGS: OpsSettings = {
  cutoffWeekday: 3,
  cutoffHour: 12,
  opsEmail: "",
};
