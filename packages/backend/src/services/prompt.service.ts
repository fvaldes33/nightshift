import { db } from "@openralph/db/config/database";
import { eq, isNull } from "@openralph/db/drizzle";
import { docs } from "@openralph/db/models/index";

/**
 * Assemble the full ralph iteration prompt.
 * Concatenates global docs (repoId IS NULL) + repo-specific docs.
 */
export async function assembleRalphPrompt(repoId: string): Promise<string> {
  const [globalDocs, repoDocs] = await Promise.all([
    db.query.docs.findMany({
      where: isNull(docs.repoId),
      orderBy: (d, { asc }) => [asc(d.title)],
    }),
    db.query.docs.findMany({
      where: eq(docs.repoId, repoId),
      orderBy: (d, { asc }) => [asc(d.title)],
    }),
  ]);

  const sections: string[] = [];

  for (const doc of globalDocs) {
    if (doc.content.trim()) {
      sections.push(`# ${doc.title}\n\n${doc.content.trim()}`);
    }
  }

  if (repoDocs.length > 0) {
    for (const doc of repoDocs) {
      if (doc.content.trim()) {
        sections.push(`# ${doc.title}\n\n${doc.content.trim()}`);
      }
    }
  }

  return sections.join("\n\n---\n\n");
}
