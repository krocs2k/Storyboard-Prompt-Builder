export interface LightingSource {
  id: string;
  name: string;
  description: string;
  image?: string;
}

export const lightingSources: LightingSource[] = [
  { id: 'backlighting', name: 'BACKLIGHTING / RIM LIGHT', description: 'backlit subject, rim light outlining edges, bright halo separation, soft foreground shadows, cinematic silhouette emphasis', image: '/images/data/a3133856-11cc-4744-ac50-4a43318326c3.png' },
  { id: 'bounce', name: 'BOUNCE LIGHTING', description: 'indirect diffused light, soft shadow falloff, gentle highlights, natural color, reflective surface bounce', image: '/images/data/01b93454-bd95-4d75-91c6-d5b0fb354009.png' },
  { id: 'broad', name: 'BROAD LIGHTING', description: 'key light aimed at visible cheek, evenly lit face, minimal shadows on camera side, open and bright portrait effect', image: '/images/data/bb668223-db54-4963-8057-234e6983784a.png' },
  { id: 'candlelight', name: 'CANDLELIGHT LIGHTING', description: 'warm flickering light, low intensity illumination, deep shadows, amber color temperature, intimate and moody atmosphere', image: '/images/data/e0fb5f26-2739-4e6a-a818-c4cc9603c8ac.png' },
  { id: 'chiaroscuro', name: 'CHIAROSCURO LIGHTING', description: 'dramatic high contrast, intense light-dark separation, deep shadows, directional highlights, painterly renaissance mood', image: '/images/data/97553277-113d-442d-a7c1-aeb0b9273bf7.jpg' },
  { id: 'color-gels', name: 'COLOR GELS', description: 'colored lighting gels, saturated hue washes, tinted shadows, stylized atmosphere, cinematic color grading effect', image: '/images/data/457efc42-f9f8-47f7-9538-ee5bd51d6cf9.png' },
  { id: 'gobo', name: 'GOBO LIGHTING', description: 'patterned projection lighting, textured shadows, shaped light cutouts, environmental storytelling, contrasty highlights', image: '/images/data/1401566e-27e4-4f72-a6dc-d720c6f71729.png' },
  { id: 'hard', name: 'HARD LIGHTING', description: 'sharp defined shadows, high contrast edges, crisp highlights, strong directional key light, minimal diffusion', image: '/images/data/bff031b4-46fc-49f6-9f24-4b644bc677a8.png' },
  { id: 'high-key', name: 'HIGH KEY LIGHTING', description: 'bright even illumination, minimal shadows, high exposure levels, low contrast, airy and clean aesthetic', image: '/images/data/bf3da9f7-3ed1-429d-a364-52f453994474.png' },
  { id: 'loop', name: 'LOOP LIGHTING', description: 'small shadow loop under nose, angled key light from above, softly defined facial contrast, classic studio portrait style', image: '/images/data/427050a9-8d1a-4fd6-812a-a4fbf53375ff.png' },
  { id: 'low-key', name: 'LOW KEY LIGHTING', description: 'dark moody illumination, deep shadows, minimal fill light, selective highlight accents, dramatic cinematic tone', image: '/images/data/e50b1da2-d36b-4fa4-aa56-1a441cbe392b.png' },
  { id: 'motivated', name: 'MOTIVATED LIGHTING', description: 'realistic light motivated by visible scene sources, believable shadow behavior, cohesive ambience, natural directionality', image: '/images/data/69d5baa7-03e1-440c-9251-74ba63ef90a0.png' },
  { id: 'neon', name: 'NEON LIGHTING', description: 'vivid neon glow, saturated colored highlights, soft falloff, retro cyberpunk mood, luminous environmental lighting', image: '/images/data/17f2f332-eaca-4214-873e-4d9bdebb72e6.png' },
  { id: 'overcast', name: 'OVERCAST LIGHTING', description: 'diffuse sky light, soft shadowless illumination, cool muted tones, low contrast, natural outdoor realism', image: '/images/data/fea8c859-09d5-4bc1-a951-64fa09e1349c.png' },
  { id: 'paramount', name: 'PARAMOUNT LIGHTING', description: 'butterfly shadow under nose, frontal high key light, symmetrical facial lighting, classic Hollywood glamour style', image: '/images/data/453c3d74-d692-4478-bdf3-4610969eb953.png' },
  { id: 'practical', name: 'PRACTICAL LIGHTING', description: 'visible light sources within scene, warm ambient glow, natural interior shadows, believable motivated illumination', image: '/images/data/730f3627-54a3-4576-b50c-c8a229aa146b.png' },
  { id: 'rembrandt', name: 'REMBRANDT LIGHTING', description: 'triangular cheek highlight, angled key from above, strong but soft contrast, classic portrait depth and shadow geometry', image: '/images/data/5a115084-9d4c-4d50-b875-5d10880f4204.png' },
  { id: 'silhouette', name: 'SILHOUETTE SHADOWS', description: 'subject in shadow, bright backlit background, minimal surface detail, high contrast outline, dramatic silhouette profile', image: '/images/data/71b41d1d-7f88-4ec0-aaea-ff4e2ee4027e.jpeg' },
  { id: 'soft', name: 'SOFT LIGHTING', description: 'diffused key light, gradual shadow transitions, low contrast, smooth highlight rolloff, flattering skin tones', image: '/images/data/6ccfabbf-7201-4888-89a9-ee1836cd53a1.jpg' },
  { id: 'split', name: 'SPLIT LIGHTING', description: 'half face lit and half in shadow, strong side key, dramatic high contrast portrait, defined light split across features', image: '/images/data/def3649f-c600-4442-a07f-8863ae98c4d8.jpg' },
  { id: 'three-point', name: 'THREE POINT LIGHTING', description: 'key + fill + rim lights, balanced facial modeling, reduced harsh shadows, professional studio arrangement', image: '/images/data/285addf3-939c-4a0c-99e2-208b002a4911.jpg' },
  { id: 'top', name: 'TOP LIGHTING', description: 'overhead key light, downward shadow direction, dark eye sockets, dramatic modeling, crisp highlights on facial planes', image: '/images/data/40f02155-600a-4db9-ba7a-93b87db44f91.jpg' },
  { id: 'under', name: 'UNDERLIGHTING', description: 'upward facing light source, reversed shadow direction, eerie facial modeling, horror mood, unnatural illumination', image: '/images/data/f4de2567-880b-40c3-b4ce-e0dcd4451c74.jpg' },
  { id: 'volumetric', name: 'VOLUMETRIC LIGHTING', description: 'visible light beams through particles, atmospheric scattering, dramatic shafts of light, enhanced environmental depth', image: '/images/data/87d3c0f5-5e12-45f5-a15b-1712cd5bbbee.jpg' },
];
