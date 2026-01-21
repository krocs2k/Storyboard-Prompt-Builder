export interface LightingSource {
  id: string;
  name: string;
  description: string;
  image?: string;
}

export const lightingSources: LightingSource[] = [
  { id: 'backlighting', name: 'BACKLIGHTING / RIM LIGHT', description: 'backlit subject, rim light outlining edges, bright halo separation, soft foreground shadows, cinematic silhouette emphasis' },
  { id: 'bounce', name: 'BOUNCE LIGHTING', description: 'indirect diffused light, soft shadow falloff, gentle highlights, natural color, reflective surface bounce' },
  { id: 'broad', name: 'BROAD LIGHTING', description: 'key light aimed at visible cheek, evenly lit face, minimal shadows on camera side, open and bright portrait effect' },
  { id: 'candlelight', name: 'CANDLELIGHT LIGHTING', description: 'warm flickering light, low intensity illumination, deep shadows, amber color temperature, intimate and moody atmosphere' },
  { id: 'chiaroscuro', name: 'CHIAROSCURO LIGHTING', description: 'dramatic high contrast, intense light-dark separation, deep shadows, directional highlights, painterly renaissance mood', image: 'https://cdn.abacus.ai/images/97553277-113d-442d-a7c1-aeb0b9273bf7.jpg' },
  { id: 'color-gels', name: 'COLOR GELS', description: 'colored lighting gels, saturated hue washes, tinted shadows, stylized atmosphere, cinematic color grading effect' },
  { id: 'gobo', name: 'GOBO LIGHTING', description: 'patterned projection lighting, textured shadows, shaped light cutouts, environmental storytelling, contrasty highlights' },
  { id: 'hard', name: 'HARD LIGHTING', description: 'sharp defined shadows, high contrast edges, crisp highlights, strong directional key light, minimal diffusion' },
  { id: 'high-key', name: 'HIGH KEY LIGHTING', description: 'bright even illumination, minimal shadows, high exposure levels, low contrast, airy and clean aesthetic' },
  { id: 'loop', name: 'LOOP LIGHTING', description: 'small shadow loop under nose, angled key light from above, softly defined facial contrast, classic studio portrait style' },
  { id: 'low-key', name: 'LOW KEY LIGHTING', description: 'dark moody illumination, deep shadows, minimal fill light, selective highlight accents, dramatic cinematic tone' },
  { id: 'motivated', name: 'MOTIVATED LIGHTING', description: 'realistic light motivated by visible scene sources, believable shadow behavior, cohesive ambience, natural directionality' },
  { id: 'neon', name: 'NEON LIGHTING', description: 'vivid neon glow, saturated colored highlights, soft falloff, retro cyberpunk mood, luminous environmental lighting', image: 'https://cdn.abacus.ai/images/17f2f332-eaca-4214-873e-4d9bdebb72e6.png' },
  { id: 'overcast', name: 'OVERCAST LIGHTING', description: 'diffuse sky light, soft shadowless illumination, cool muted tones, low contrast, natural outdoor realism' },
  { id: 'paramount', name: 'PARAMOUNT LIGHTING', description: 'butterfly shadow under nose, frontal high key light, symmetrical facial lighting, classic Hollywood glamour style' },
  { id: 'practical', name: 'PRACTICAL LIGHTING', description: 'visible light sources within scene, warm ambient glow, natural interior shadows, believable motivated illumination' },
  { id: 'rembrandt', name: 'REMBRANDT LIGHTING', description: 'triangular cheek highlight, angled key from above, strong but soft contrast, classic portrait depth and shadow geometry' },
  { id: 'silhouette', name: 'SILHOUETTE SHADOWS', description: 'subject in shadow, bright backlit background, minimal surface detail, high contrast outline, dramatic silhouette profile' },
  { id: 'soft', name: 'SOFT LIGHTING', description: 'diffused key light, gradual shadow transitions, low contrast, smooth highlight rolloff, flattering skin tones' },
  { id: 'split', name: 'SPLIT LIGHTING', description: 'half face lit and half in shadow, strong side key, dramatic high contrast portrait, defined light split across features' },
  { id: 'three-point', name: 'THREE POINT LIGHTING', description: 'key + fill + rim lights, balanced facial modeling, reduced harsh shadows, professional studio arrangement' },
  { id: 'top', name: 'TOP LIGHTING', description: 'overhead key light, downward shadow direction, dark eye sockets, dramatic modeling, crisp highlights on facial planes' },
  { id: 'under', name: 'UNDERLIGHTING', description: 'upward facing light source, reversed shadow direction, eerie facial modeling, horror mood, unnatural illumination' },
  { id: 'volumetric', name: 'VOLUMETRIC LIGHTING', description: 'visible light beams through particles, atmospheric scattering, dramatic shafts of light, enhanced environmental depth', image: 'https://cdn.abacus.ai/images/87d3c0f5-5e12-45f5-a15b-1712cd5bbbee.jpg' },
];
