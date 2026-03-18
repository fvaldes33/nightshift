import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openralph/ui/components/form";
import { Input } from "@openralph/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRepos } from "~/hooks/use-collection";
import { trpc } from "~/lib/trpc-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const startLoopSchema = z.object({
  name: z.string().min(1, "Name is required"),
  repoId: z.string().uuid("Select a repository"),
  branch: z.string().optional(),
  maxIterations: z.number().int().min(1).max(100),
});

type StartLoopForm = z.infer<typeof startLoopSchema>;

export function StartLoopDialog({
  open,
  onOpenChange,
  repoId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId?: string;
}) {
  const { data: repos } = useRepos();
  const [branchTouched, setBranchTouched] = useState(false);

  const form = useForm<StartLoopForm>({
    resolver: zodResolver(startLoopSchema),
    defaultValues: {
      name: "",
      repoId: repoId ?? "",
      branch: "",
      maxIterations: 10,
    },
  });

  const name = form.watch("name");

  // Auto-derive branch from name unless user has manually edited it
  useEffect(() => {
    if (!branchTouched && name) {
      form.setValue("branch", `nightshift/${slugify(name)}`);
    } else if (!branchTouched && !name) {
      form.setValue("branch", "");
    }
  }, [name, branchTouched, form]);

  const startLoop = trpc.loop.start.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      setBranchTouched(false);
    },
  });

  function onSubmit(values: StartLoopForm) {
    startLoop.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Loop</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Fix all lint errors" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!repoId && (
              <FormField
                control={form.control}
                name="repoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="Select repo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {repos.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.owner}/{r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="nightshift/my-feature"
                      {...field}
                      onChange={(e) => {
                        setBranchTouched(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxIterations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Iterations</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" size="sm" disabled={startLoop.isPending}>
                {startLoop.isPending ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Loop"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
