'use client';

import CreationBibleEditor from '@/components/creation-bible-editor';

export default function NovelBiblePage() {
  return (
    <CreationBibleEditor
      kind="novel"
      title="Novel Creation Bible"
      subtitle="Core guidance that drives every novel"
      iconWrapClass="bg-indigo-500/20"
      iconClass="text-indigo-400"
      description="Populate this bible with the canon, voice, style rules, world details, tone, structure, and any instructions that should be at the core of every novel the app generates. When saved, this content is injected as authoritative, overriding guidance into the novel and audio drama novel generation — taking precedence over the generic writing instructions."
      placeholder={'e.g.\n\nVOICE & TONE:\n- Literary, introspective, present tense...\n\nWORLD / CANON:\n- ...\n\nSTRUCTURE RULES:\n- ...\n\nAVOID:\n- ...'}
    />
  );
}
