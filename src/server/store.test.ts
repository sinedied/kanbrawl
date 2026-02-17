import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BoardStore } from "./store.js";
import type { BoardEvent } from "./types.js";

function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), "kanbrawl-store-test-"));
  const filePath = join(dir, "kanbrawl.json");
  const store = new BoardStore(filePath);
  return { store, filePath, dir };
}

describe("BoardStore", () => {
  let store: BoardStore;
  let filePath: string;
  let dir: string;

  beforeEach(() => {
    ({ store, filePath, dir } = createTestStore());
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // --- Initialization ---
  describe("initialization", () => {
    it("creates kanbrawl.json with defaults when file does not exist", () => {
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.columns).toEqual(["Todo", "In progress", "Blocked", "Done"]);
      expect(data.tasks).toEqual([]);
    });

    it("loads existing data from file", () => {
      const existingDir = mkdtempSync(join(tmpdir(), "kanbrawl-store-test-"));
      const existingPath = join(existingDir, "kanbrawl.json");
      writeFileSync(existingPath, JSON.stringify({
        columns: ["A", "B"],
        tasks: [{
          id: "test-id",
          title: "Existing",
          description: "",
          column: "A",
          priority: "P1",
          assignee: "",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        }],
      }));

      const loaded = new BoardStore(existingPath);
      expect(loaded.getColumns()).toEqual(["A", "B"]);
      expect(loaded.getTasks()).toHaveLength(1);
      expect(loaded.getTasks()[0].title).toBe("Existing");
      rmSync(existingDir, { recursive: true, force: true });
    });

    it("fills in missing fields from partial file", () => {
      const partialDir = mkdtempSync(join(tmpdir(), "kanbrawl-store-test-"));
      const partialPath = join(partialDir, "kanbrawl.json");
      writeFileSync(partialPath, JSON.stringify({}));

      const loaded = new BoardStore(partialPath);
      expect(loaded.getColumns()).toEqual(["Todo", "In progress", "Blocked", "Done"]);
      expect(loaded.getTasks()).toEqual([]);
      rmSync(partialDir, { recursive: true, force: true });
    });
  });

  // --- getBoard ---
  describe("getBoard", () => {
    it("returns a deep clone of board data", () => {
      const board = store.getBoard();
      expect(board.columns).toEqual(["Todo", "In progress", "Blocked", "Done"]);
      expect(board.tasks).toEqual([]);

      // Mutating the clone should not affect the store
      board.columns.push("Extra");
      expect(store.getColumns()).toHaveLength(4);
    });
  });

  // --- getColumns ---
  describe("getColumns", () => {
    it("returns default columns", () => {
      expect(store.getColumns()).toEqual(["Todo", "In progress", "Blocked", "Done"]);
    });

    it("returns a copy (not a reference)", () => {
      const cols = store.getColumns();
      cols.push("Extra");
      expect(store.getColumns()).toHaveLength(4);
    });
  });

  // --- createTask ---
  describe("createTask", () => {
    it("creates a task with defaults", () => {
      const task = store.createTask("My task");
      expect(task.title).toBe("My task");
      expect(task.column).toBe("Todo");
      expect(task.priority).toBe("P1");
      expect(task.description).toBe("");
      expect(task.assignee).toBe("");
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBe(task.createdAt);
    });

    it("creates a task with all fields", () => {
      const task = store.createTask("Task", "Description", "In progress", "P0", "agent");
      expect(task.title).toBe("Task");
      expect(task.description).toBe("Description");
      expect(task.column).toBe("In progress");
      expect(task.priority).toBe("P0");
      expect(task.assignee).toBe("agent");
    });

    it("throws for invalid column", () => {
      expect(() => store.createTask("Task", undefined, "Nonexistent"))
        .toThrow(/does not exist/);
    });

    it("persists to disk", () => {
      store.createTask("Persisted");
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0].title).toBe("Persisted");
    });

    it("emits task_created event", () => {
      const events: BoardEvent[] = [];
      store.onChange((e) => events.push(e));

      store.createTask("Evented");
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("task_created");
      if (events[0].type === "task_created") {
        expect(events[0].task.title).toBe("Evented");
      }
    });
  });

  // --- getTasks ---
  describe("getTasks", () => {
    it("returns all tasks when no column specified", () => {
      store.createTask("A");
      store.createTask("B", undefined, "Done");
      expect(store.getTasks()).toHaveLength(2);
    });

    it("filters by column", () => {
      store.createTask("A");
      store.createTask("B", undefined, "Done");
      expect(store.getTasks("Todo")).toHaveLength(1);
      expect(store.getTasks("Done")).toHaveLength(1);
      expect(store.getTasks("In progress")).toHaveLength(0);
    });

    it("returns deep clones", () => {
      store.createTask("Original");
      const tasks = store.getTasks();
      tasks[0].title = "Mutated";
      expect(store.getTasks()[0].title).toBe("Original");
    });
  });

  // --- getTask ---
  describe("getTask", () => {
    it("returns a task by id", () => {
      const created = store.createTask("Find me");
      const found = store.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find me");
    });

    it("returns undefined for unknown id", () => {
      expect(store.getTask("nonexistent")).toBeUndefined();
    });

    it("returns a deep clone", () => {
      const created = store.createTask("Original");
      const found = store.getTask(created.id)!;
      found.title = "Mutated";
      expect(store.getTask(created.id)!.title).toBe("Original");
    });
  });

  // --- moveTask ---
  describe("moveTask", () => {
    it("moves a task to a different column", () => {
      const task = store.createTask("Movable");
      const moved = store.moveTask(task.id, "Done");
      expect(moved.column).toBe("Done");
      expect(store.getTask(task.id)!.column).toBe("Done");
    });

    it("updates the updatedAt timestamp", () => {
      const task = store.createTask("Movable");
      const moved = store.moveTask(task.id, "Done");
      expect(new Date(moved.updatedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(task.updatedAt).getTime());
    });

    it("throws for non-existent task", () => {
      expect(() => store.moveTask("nonexistent", "Done")).toThrow(/not found/);
    });

    it("throws for invalid column", () => {
      const task = store.createTask("Task");
      expect(() => store.moveTask(task.id, "Nonexistent")).toThrow(/does not exist/);
    });

    it("emits task_moved event with fromColumn", () => {
      const events: BoardEvent[] = [];
      const task = store.createTask("Movable");
      store.onChange((e) => events.push(e));

      store.moveTask(task.id, "In progress");
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("task_moved");
      if (events[0].type === "task_moved") {
        expect(events[0].fromColumn).toBe("Todo");
        expect(events[0].task.column).toBe("In progress");
      }
    });

    it("persists to disk", () => {
      const task = store.createTask("Movable");
      store.moveTask(task.id, "Done");
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.tasks[0].column).toBe("Done");
    });
  });

  // --- updateTask ---
  describe("updateTask", () => {
    it("updates title", () => {
      const task = store.createTask("Original");
      const updated = store.updateTask(task.id, { title: "New title" });
      expect(updated.title).toBe("New title");
    });

    it("updates multiple fields", () => {
      const task = store.createTask("Task");
      const updated = store.updateTask(task.id, {
        description: "Desc",
        priority: "P0",
        assignee: "bob",
      });
      expect(updated.description).toBe("Desc");
      expect(updated.priority).toBe("P0");
      expect(updated.assignee).toBe("bob");
    });

    it("updates only provided fields, leaves others unchanged", () => {
      const task = store.createTask("Task", "Original desc", "Todo", "P1", "alice");
      const updated = store.updateTask(task.id, { title: "New" });
      expect(updated.title).toBe("New");
      expect(updated.description).toBe("Original desc");
      expect(updated.assignee).toBe("alice");
    });

    it("throws for non-existent task", () => {
      expect(() => store.updateTask("nonexistent", { title: "X" })).toThrow(/not found/);
    });

    it("emits task_updated event", () => {
      const events: BoardEvent[] = [];
      const task = store.createTask("Task");
      store.onChange((e) => events.push(e));

      store.updateTask(task.id, { title: "Updated" });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("task_updated");
    });

    it("persists to disk", () => {
      const task = store.createTask("Task");
      store.updateTask(task.id, { title: "Persisted" });
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.tasks[0].title).toBe("Persisted");
    });
  });

  // --- deleteTask ---
  describe("deleteTask", () => {
    it("deletes a task", () => {
      const task = store.createTask("To delete");
      store.deleteTask(task.id);
      expect(store.getTasks()).toHaveLength(0);
    });

    it("throws for non-existent task", () => {
      expect(() => store.deleteTask("nonexistent")).toThrow(/not found/);
    });

    it("emits task_deleted event", () => {
      const events: BoardEvent[] = [];
      const task = store.createTask("Task");
      store.onChange((e) => events.push(e));

      store.deleteTask(task.id);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("task_deleted");
      if (events[0].type === "task_deleted") {
        expect(events[0].taskId).toBe(task.id);
      }
    });

    it("persists to disk", () => {
      const task = store.createTask("Task");
      store.deleteTask(task.id);
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.tasks).toHaveLength(0);
    });
  });

  // --- updateColumns ---
  describe("updateColumns", () => {
    it("replaces columns", () => {
      const result = store.updateColumns(["A", "B", "C"]);
      expect(result).toEqual(["A", "B", "C"]);
      expect(store.getColumns()).toEqual(["A", "B", "C"]);
    });

    it("trims and deduplicates column names", () => {
      const result = store.updateColumns(["  A ", "B", "A", " B "]);
      expect(result).toEqual(["A", "B"]);
    });

    it("throws for empty array", () => {
      expect(() => store.updateColumns([])).toThrow(/at least one/i);
    });

    it("throws for all-whitespace names", () => {
      expect(() => store.updateColumns(["  ", ""])).toThrow(/at least one/i);
    });

    it("moves tasks from removed columns to first column", () => {
      store.createTask("In blocked", undefined, "Blocked");
      store.updateColumns(["Todo", "Done"]);
      const task = store.getTasks()[0];
      expect(task.column).toBe("Todo");
    });

    it("emits columns_updated event", () => {
      const events: BoardEvent[] = [];
      store.onChange((e) => events.push(e));

      store.updateColumns(["X", "Y"]);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("columns_updated");
      if (events[0].type === "columns_updated") {
        expect(events[0].columns).toEqual(["X", "Y"]);
      }
    });

    it("persists to disk", () => {
      store.updateColumns(["Alpha", "Beta"]);
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      expect(data.columns).toEqual(["Alpha", "Beta"]);
    });
  });

  // --- onChange ---
  describe("onChange", () => {
    it("returns an unsubscribe function", () => {
      const events: BoardEvent[] = [];
      const unsub = store.onChange((e) => events.push(e));

      store.createTask("Before unsub");
      expect(events).toHaveLength(1);

      unsub();
      store.createTask("After unsub");
      expect(events).toHaveLength(1);
    });

    it("supports multiple listeners", () => {
      const events1: BoardEvent[] = [];
      const events2: BoardEvent[] = [];
      store.onChange((e) => events1.push(e));
      store.onChange((e) => events2.push(e));

      store.createTask("Task");
      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });
});
