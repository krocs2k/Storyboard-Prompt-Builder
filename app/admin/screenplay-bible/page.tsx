'use client';

import CreationBibleEditor from '@/components/creation-bible-editor';

export default function ScreenplayBiblePage() {
  return (
    <CreationBibleEditor
      kind="screenplay"
      title="Screenplay Creation Bible"
      subtitle="Core guidance that drives every screenplay"
      iconWrapClass="bg-violet-500/20"
      iconClass="text-violet-400"
      description="Populate this bible with the canon, voice, formatting rules, world details, tone, structure, and any instructions that should be at the core of every screenplay the app generates. When saved, this content is injected as authoritative, overriding guidance into the screenplay creation flow (tropes, ideas, concepts, screenplays and continuations) — taking precedence over the generic writing instructions."
      placeholder={'e.g.\n\nVOICE & TONE:\n- Kinetic, cinematic, visual-first...\n\nWORLD / CANON:\n- ...\n\nFORMAT RULES:\n- ...\n\nAVOID:\n- ...'}
    />
  );
}
