// Mammoth is already typed via its own package

// Project types
export interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  projects?: Project[];
  _count?: { projects: number };
}

export interface Project {
  id: string;
  name: string;
  folderId: string | null;
  folder?: ProjectFolder | null;
  screenplay?: Screenplay | null;
  storyboard?: Storyboard | null;
  selections?: SelectionState | null;
  recommendations?: AnalysisRecommendations | null;
  createdAt: string;
  updatedAt: string;
}

export interface Screenplay {
  id: string;
  projectId: string;
  title: string;
  runtime: number;
  content: string;
  characters: Character[];
  environments: Environment[];
  sourceType: 'youtube' | 'concept' | 'upload' | 'manual';
  sourceUrl?: string | null;
  storyIdea?: string | null;
  characterPrompts?: CharacterPrompt[] | null;
  environmentPrompts?: EnvironmentPrompt[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  id: string;
  projectId: string;
  blocks: StoryboardBlock[];
  shotlist: Record<string, ShotlistItem[]>;
  totalBlocks: number;
  estimatedRuntime: number;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  name: string;
  description: string;
}

export interface Environment {
  name: string;
  description: string;
}

export interface CharacterPrompt {
  name: string;
  prompt: string;
}

export interface EnvironmentPrompt {
  name: string;
  prompt: string;
}

export interface StoryboardBlock {
  blockNumber: number;
  timestampStart: string;
  timestampEnd: string;
  scene: string;
  location: string;
  action: string;
  prompt: string;
  shotType: string;
  lighting: string;
  notes?: string;
}

export interface ShotlistItem {
  blockNumber: number;
  shotType: string;
  action: string;
  prompt: string;
}

export interface StoryConcept {
  id: number;
  title: string;
  synopsis: string;
  paranormalElement: string;
  emotionalHook: string;
}

export interface AnalysisRecommendations {
  title?: string;
  estimatedRuntime?: number;
  genre?: string;
  mood?: string;
  recommendations: {
    imageType?: { recommended: string; reason: string };
    shotTypes?: Array<{ type: string; reason: string }>;
    lighting?: Array<{ type: string; reason: string }>;
    cameraBody?: { recommended: string; reason: string };
    focalLength?: { recommended: string; reason: string };
    lensType?: { recommended: string; reason: string };
    filmStock?: { recommended: string; reason: string };
    aspectRatio?: { recommended: string; reason: string };
    photographerStyle?: { recommended: string; reason: string };
    movieStyle?: { recommended: string; reason: string };
    filterEffect?: { recommended: string; reason: string };
  };
  characters: Character[];
  environments: Environment[];
}

export interface SelectionState {
  imageType?: { id: string; name: string; image?: string };
  shotType?: { id: string; name: string; image?: string };
  subjectAction?: string;
  environment?: string;
  lighting?: { id: string; name: string; description?: string; image?: string };
  atmosphere?: string;
  cameraBody?: { id: string; name: string; description?: string; style?: string };
  focalLength?: { id: string; name: string; description?: string };
  lensType?: { id: string; name: string; description?: string };
  filmStock?: { id: string; name: string; description?: string };
  aspectRatio?: string;
  photographer?: { id: string; name: string; description?: string; style?: string };
  movie?: { id: string; name: string; description?: string; style?: string };
  filter?: { id: string; name: string; description?: string };
}
