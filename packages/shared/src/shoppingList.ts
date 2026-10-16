export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface WeeklyShoppingList {
  startDate: string;
  endDate: string;
  shoppingListVersion: string;
  sourcePlanVersion: string;
  items: ShoppingListItem[];
  totalItems: number;
  notice: string;
}
