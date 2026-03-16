import { relations } from "drizzle-orm";
import { docs } from "./doc.model";
import { loops } from "./loop.model";
import { messages } from "./message.model";
import { repos } from "./repo.model";
import { sessions } from "./session.model";
import { tasks } from "./task.model";

// Repos
export const reposRelations = relations(repos, ({ many }) => ({
  sessions: many(sessions),
  tasks: many(tasks),
  loops: many(loops),
  docs: many(docs),
}));

// Sessions
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  repo: one(repos, { fields: [sessions.repoId], references: [repos.id] }),
  messages: many(messages),
  tasks: many(tasks),
  loops: many(loops),
}));

// Messages
export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, { fields: [messages.sessionId], references: [sessions.id] }),
}));

// Tasks
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  repo: one(repos, { fields: [tasks.repoId], references: [repos.id] }),
  session: one(sessions, { fields: [tasks.sessionId], references: [sessions.id] }),
  parent: one(tasks, { fields: [tasks.parentId], references: [tasks.id], relationName: "subtasks" }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  loops: many(loops),
}));

// Loops
export const loopsRelations = relations(loops, ({ one }) => ({
  session: one(sessions, { fields: [loops.sessionId], references: [sessions.id] }),
  repo: one(repos, { fields: [loops.repoId], references: [repos.id] }),
  task: one(tasks, { fields: [loops.taskId], references: [tasks.id] }),
}));

// Docs
export const docsRelations = relations(docs, ({ one }) => ({
  repo: one(repos, { fields: [docs.repoId], references: [repos.id] }),
}));
