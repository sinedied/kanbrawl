export type Priority = "P0" | "P1" | "P2";

export interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  columns: string[];
  tasks: Task[];
  theme?: "light" | "dark";
}
