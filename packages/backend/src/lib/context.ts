import { AsyncLocalStorage } from "node:async_hooks";
import type { auth } from "./auth";

export type User = typeof auth.$Infer.Session.user;

export function createContext<T>() {
  const storage = new AsyncLocalStorage<T>();
  return {
    use() {
      const result = storage.getStore();
      if (!result) {
        throw new Error("No context available");
      }
      return result;
    },
    with<R>(value: T, fn: () => R) {
      return storage.run<R>(value, fn);
    },
    set(value: T) {
      storage.enterWith(value);
    },
  };
}

interface PublicActor {
  type: "public";
  properties: Record<string, never>;
}

interface UserActor {
  type: "user";
  properties: {
    user: User;
  };
}

export type Actor = PublicActor | UserActor;

export const ActorContext = createContext<Actor>();
