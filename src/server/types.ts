export interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbrawlData {
  columns: string[];
  tasks: Task[];
}

export type BoardEvent =
  | { type: "task_created"; task: Task }
  | { type: "task_updated"; task: Task }
  | { type: "task_moved"; task: Task; fromColumn: string }
  | { type: "task_deleted"; taskId: string }
  | { type: "board_sync"; board: KanbrawlData };
