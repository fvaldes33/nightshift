import { useHydrated } from "~/hooks/use-hydrated";

type ClientOnlyProps = {
  children(): React.ReactNode;
  fallback?: React.ReactNode;
};

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  return useHydrated() ? children() : fallback;
}
