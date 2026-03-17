import { zodResolver } from "@hookform/resolvers/zod";
import { createCaller } from "@openralph/backend/lib/caller";
import { insertSessionSchema } from "@openralph/db/models/index";
import { Button } from "@openralph/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@openralph/ui/components/combobox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openralph/ui/components/form";
import { Input } from "@openralph/ui/components/input";
import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useLoaderData, useNavigate } from "react-router";
import { z } from "zod";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/new";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const newSessionSchema = insertSessionSchema.pick({ title: true }).extend({
  repoFullName: z.string().min(1, "Select a repository"),
  branch: z.string().optional(),
});

type NewSessionForm = z.infer<typeof newSessionSchema>;

type RepoOption = {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  cloneUrl: string | null;
  isLocal: boolean;
};

export async function loader({ request }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const [repos, githubRepos] = await Promise.all([
    caller.repo.list({}),
    caller.repo.listGitHub({}).catch(() => []),
  ]);
  return { repos, githubRepos };
}

export function meta() {
  return [{ title: "New Session — nightshift" }];
}

export default function NewSession() {
  const { repos, githubRepos } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [branchTouched, setBranchTouched] = useState(false);

  const createRepo = trpc.repo.create.useMutation();
  const createSession = trpc.session.create.useMutation();

  const form = useForm<NewSessionForm>({
    resolver: zodResolver(newSessionSchema),
    defaultValues: {
      title: "",
      repoFullName: "",
      branch: "",
    },
  });

  const title = form.watch("title");

  // Auto-derive branch from title unless user has manually edited it
  useEffect(() => {
    if (!branchTouched && title) {
      form.setValue("branch", `nightshift/${slugify(title)}`);
    } else if (!branchTouched && !title) {
      form.setValue("branch", "");
    }
  }, [title, branchTouched, form]);

  // Merge local + GitHub repos, deduped
  const repoOptions = useMemo<RepoOption[]>(() => {
    const local: RepoOption[] = repos.map((r) => ({
      fullName: `${r.owner}/${r.name}`,
      owner: r.owner,
      name: r.name,
      defaultBranch: r.defaultBranch,
      cloneUrl: r.cloneUrl,
      isLocal: true,
    }));
    const remote: RepoOption[] = githubRepos
      .filter((gr) => !repos.some((r) => r.owner === gr.owner && r.name === gr.name))
      .map((r) => ({
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
        cloneUrl: r.cloneUrl,
        isLocal: false,
      }));
    return [...local, ...remote];
  }, [repos, githubRepos]);

  async function onSubmit(values: NewSessionForm) {
    setSubmitting(true);
    try {
      const selected = repoOptions.find((r) => r.fullName === values.repoFullName);
      let repo = repos.find((r) => `${r.owner}/${r.name}` === values.repoFullName);

      if (!repo && selected) {
        repo = await createRepo.mutateAsync({
          owner: selected.owner,
          name: selected.name,
          defaultBranch: selected.defaultBranch,
          cloneUrl: selected.cloneUrl,
        });
      }

      if (!repo) return;

      const session = await createSession.mutateAsync({
        repoId: repo.id,
        title: values.title,
        mode: "plan",
        branch: values.branch || null,
      });

      navigate(`/sessions/${session.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  const selectedRepoValue = form.watch("repoFullName");
  const selectedOption = repoOptions.find((r) => r.fullName === selectedRepoValue) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">New Session</h1>
        <p className="text-muted-foreground text-sm">Start a new coding session.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="repoFullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repository</FormLabel>
                <FormControl>
                  <Combobox
                    items={repoOptions}
                    value={selectedOption}
                    onValueChange={(item: RepoOption | null) => {
                      field.onChange(item?.fullName ?? "");
                    }}
                    itemToStringLabel={(item: RepoOption) => item.fullName}
                  >
                    <ComboboxInput
                      showClear={!!selectedRepoValue}
                      showTrigger={!selectedRepoValue}
                      placeholder="Search repos..."
                      className="font-mono text-sm"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No repos found</ComboboxEmpty>
                      <ComboboxList>
                        {(item: RepoOption) => (
                          <ComboboxItem key={item.fullName} value={item}>
                            <span className="font-mono text-sm">{item.fullName}</span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Fix auth redirect bug" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormControl>
                  <Input
                    placeholder="nightshift/fix-auth-redirect"
                    className="font-mono text-sm"
                    {...field}
                    onChange={(e) => {
                      setBranchTouched(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Auto-generated from title. Edit to override.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting && <Loader2Icon className="size-4 animate-spin" />}
            Start Session
          </Button>
        </form>
      </Form>
    </div>
  );
}
