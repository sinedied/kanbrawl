export type Priority = 'P0' | 'P1' | 'P2';

export type SortBy = 'priority' | 'created' | 'updated';
export type SortOrder = 'asc' | 'desc';

export type Column = {
  name: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
};

export type Board = {
  columns: Column[];
  tasks: Task[];
  theme?: 'light' | 'dark';
};
