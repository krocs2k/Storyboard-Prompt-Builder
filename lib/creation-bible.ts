/**
 * CREATION BIBLE
 * ==============
 * Admin-authored "bible" content that drives the creation of Novels and
 * Screenplays. The content is stored in the SystemConfig key-value table so an
 * administrator can populate/edit it in-app (Administration → Novel/Screenplay
 * Creation Bible) and have it immediately steer every LLM generation call.
 *
 * When populated, the bible is injected as an AUTHORITATIVE block into the
 * task-specific system prompt of the relevant generation routes, ahead of the
 * generic instructions, so it takes precedence in shaping the output.
 */

import { prisma } from '@/lib/db';

export type BibleKind = 'novel' | 'screenplay';

export const CREATION_BIBLE_KEYS: Record<BibleKind, string> = {
  novel: 'novel_creation_bible',
  screenplay: 'screenplay_creation_bible',
};

const BIBLE_LABEL: Record<BibleKind, string> = {
  novel: 'NOVEL CREATION BIBLE',
  screenplay: 'SCREENPLAY CREATION BIBLE',
};

/**
 * Fetch the raw admin-authored bible content for a given kind.
 * Returns an empty string when nothing has been configured.
 */
export async function getCreationBible(kind: BibleKind): Promise<string> {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: CREATION_BIBLE_KEYS[kind] },
    });
    return (row?.value || '').trim();
  } catch (err) {
    console.error(`Failed to load ${kind} creation bible:`, err);
    return '';
  }
}

/**
 * Build the authoritative bible block for injection into a system prompt.
 * Returns an empty string when the bible is not configured.
 */
export function formatBibleBlock(kind: BibleKind, content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return '';
  const label = BIBLE_LABEL[kind];
  return `═════════════════════════════════════════════════
${label} — AUTHORITATIVE, OVERRIDING GUIDANCE
═════════════════════════════════════════════════
The following is the definitive creative bible authored by the production. It is
the CORE reference that must drive this work. Honor its rules, voice, canon,
style, constraints, and instructions above any generic guidance. Where it
conflicts with generic instructions, THIS BIBLE WINS.

${trimmed}
═════════════════════════════════════════════════
END OF ${label}
═════════════════════════════════════════════════`;
}

/**
 * Prepend the configured creation bible (if any) to a task-specific system
 * prompt. Safe to call unconditionally — when no bible is configured the
 * original prompt is returned unchanged.
 */
export async function withCreationBible(kind: BibleKind, systemPrompt: string): Promise<string> {
  const content = await getCreationBible(kind);
  const block = formatBibleBlock(kind, content);
  if (!block) return systemPrompt;
  return `${block}\n\n${systemPrompt}`;
}
