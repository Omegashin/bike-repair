import { useEffect } from "react";

export const SHOP_NAME = "Bike Repair Tracker";

// Each screen names itself in the browser tab, which screen readers also announce.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${SHOP_NAME}`;
  }, [title]);
}
