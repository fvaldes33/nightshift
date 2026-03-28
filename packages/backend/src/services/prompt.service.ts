import { db } from "@openralph/db/config/database";
import { and, eq, inArray, isNull } from "@openralph/db/drizzle";
import { docs } from "@openralph/db/models/index";

/** Concatenate doc records into markdown sections separated by `---`. */
function formatDocs(allDocs: { title: string; content: string }[]): string {
  const sections: string[] = [];
  for (const doc of allDocs) {
    if (doc.content.trim()) {
      sections.push(`# ${doc.title}\n\n${doc.content.trim()}`);
    }
  }
  return sections.join("\n\n---\n\n");
}

/**
 * Assemble the full ralph iteration prompt.
 * Concatenates global + repo-specific docs where target is "all" or "ralph".
 */
export async function assembleRalphPrompt(repoId: string): Promise<string> {
  const [globalDocs, repoDocs] = await Promise.all([
    db.query.docs.findMany({
      where: and(isNull(docs.repoId), inArray(docs.target, ["all", "ralph"])),
      orderBy: (d, { asc }) => [asc(d.title)],
    }),
    db.query.docs.findMany({
      where: and(eq(docs.repoId, repoId), inArray(docs.target, ["all", "ralph"])),
      orderBy: (d, { asc }) => [asc(d.title)],
    }),
  ]);

  return formatDocs([...globalDocs, ...repoDocs]);
}

/**
 * Assemble context docs for chat sessions.
 * Concatenates global + repo-specific docs where target is "all" or "chat".
 */
export async function assembleChatDocs(repoId: string | null): Promise<string> {
  const [globalDocs, repoDocs] = await Promise.all([
    db.query.docs.findMany({
      where: and(isNull(docs.repoId), inArray(docs.target, ["all", "chat"])),
      orderBy: (d, { asc }) => [asc(d.title)],
    }),
    repoId
      ? db.query.docs.findMany({
          where: and(eq(docs.repoId, repoId), inArray(docs.target, ["all", "chat"])),
          orderBy: (d, { asc }) => [asc(d.title)],
        })
      : Promise.resolve([]),
  ]);

  return formatDocs([...globalDocs, ...repoDocs]);
}
