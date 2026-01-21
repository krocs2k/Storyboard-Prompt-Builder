export interface ImageType {
  id: string;
  name: string;
  image?: string;
}

export const imageTypes: ImageType[] = [
  { id: 'photorealistic', name: 'Photorealistic', image: 'https://cdn.abacus.ai/images/8410a2c5-26cd-4edb-b4f7-3faa83cab12b.png' },
  { id: 'anime', name: 'Anime cel-shading style', image: 'https://cdn.abacus.ai/images/2e89fc3d-60bb-4ffa-b6bc-e3589cee6ace.jpg' },
  { id: 'cartoon', name: 'Cartoon style' },
  { id: '3d-chibi', name: '3D chibi diorama' },
  { id: 'watercolor', name: 'Watercolor painting', image: 'https://cdn.abacus.ai/images/5dcbe524-4083-4d80-9631-8d2f88666a6c.jpg' },
  { id: 'oil-painting', name: 'Oil painting' },
  { id: 'pencil-sketch', name: 'Detailed pencil sketch' },
  { id: 'comic', name: 'Comic book style illustration', image: 'https://cdn.abacus.ai/images/a47ab538-f2c9-49dd-88b0-5dafac44b284.jpg' },
  { id: 'claymation', name: 'Claymation style' },
  { id: 'impressionist', name: 'Impressionist painting' },
  { id: 'toy-photo', name: 'Toy photograph style' },
  { id: 'blueprint', name: 'Blueprint diagram style' },
];
