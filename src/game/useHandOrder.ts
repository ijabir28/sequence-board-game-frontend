import { useCallback, useState } from 'react';
import { normalizeOrder, type HandOrder } from './handOrder';

type Orders = Record<string, number[]>;

function load(storageKey: string | undefined): Orders {
  if (!storageKey) return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as unknown;
    return saved && typeof saved === 'object' ? (saved as Orders) : {};
  } catch {
    return {};
  }
}

function save(storageKey: string | undefined, orders: Orders) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(orders));
  } catch {
    // Private mode or full storage: the order still holds for this visit.
  }
}

/**
 * The display order of `owner`'s hand (see handOrder.ts). Each owner keeps their own order, so hot-seat players
 * don't rearrange each other's hands. With `storageKey` the orders survive a reload on this device.
 */
export function useHandOrder(owner: string | null, handLength: number, storageKey?: string) {
  const [orders, setOrders] = useState<Orders>(() => load(storageKey));
  const order = normalizeOrder(owner === null ? null : orders[owner], handLength);

  const setOrder = useCallback(
    (next: HandOrder) => {
      if (owner === null) return;
      setOrders((prev) => {
        const updated = { ...prev, [owner]: [...next] };
        save(storageKey, updated);
        return updated;
      });
    },
    [owner, storageKey],
  );

  return { order, setOrder };
}
