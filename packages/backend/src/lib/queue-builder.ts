import type { Job, Queue, SendOptions, WorkOptions } from "pg-boss";
import type { z } from "zod";
import { boss } from "../config/queue";

export class QueueBuilder<TInput extends Record<string, unknown>> {
  public name: string;
  public schema: z.ZodType<TInput>;
  public queueOptions: Omit<Queue, "name">;
  public workOptions: WorkOptions;
  private handler?: (job: Job<TInput>) => Promise<void> | void;

  constructor(config: {
    name: string;
    input: z.ZodType<TInput>;
    queueOptions?: Omit<Queue, "name">;
    workOptions?: WorkOptions;
  }) {
    this.name = config.name;
    this.schema = config.input;
    this.queueOptions = config.queueOptions ?? {};
    this.workOptions = config.workOptions ?? {};
  }

  /** Create the queue and register the worker. Must be called after boss.start(). */
  async init() {
    const queue = await boss.getQueue(this.name);
    if (!queue) {
      await boss.createQueue(this.name, this.queueOptions);
    }

    if (this.handler) {
      const handler = this.handler;
      await boss.work<TInput>(this.name, this.workOptions, async (jobs: Job<TInput>[]) => {
        const results = await Promise.allSettled(jobs.map((job) => handler(job)));
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result?.status === "rejected") {
            console.error(`[${this.name}] Job ${jobs[i]?.id} failed:`, result.reason);
          }
        }
      });
    }
  }

  async send(data: TInput, options: SendOptions = {}) {
    const parsed = this.schema.parse(data);
    return boss.send(this.name, parsed, options);
  }

  /** Store the worker handler. Actual registration happens in init() after boss.start(). */
  work(handler: (job: Job<TInput>) => Promise<void> | void) {
    this.handler = handler;
    return this;
  }
}

export function createQueue<T extends Record<string, unknown>>(config: {
  name: string;
  input: z.ZodType<T>;
  queueOptions?: Omit<Queue, "name">;
  workOptions?: WorkOptions;
}) {
  return new QueueBuilder(config);
}
