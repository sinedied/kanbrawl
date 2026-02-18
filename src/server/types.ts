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

export type KanbrawlData = {
  columns: Column[];
  tasks: Task[];
  theme?: 'light' | 'dark';
};

export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'task_moved'; task: Task; fromColumn: string }
  | { type: 'task_deleted'; taskId: string }
  | { type: 'columns_updated'; columns: Column[] }
  | { type: 'board_sync'; board: KanbrawlData };
