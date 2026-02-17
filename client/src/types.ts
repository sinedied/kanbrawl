export interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  columns: string[];
  tasks: Task[];
  theme?: "light" | "dark";
}
