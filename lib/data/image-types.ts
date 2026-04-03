export interface ImageType {
  id: string;
  name: string;
  image?: string;
}

export const imageTypes: ImageType[] = [
  { id: 'photorealistic', name: 'Photorealistic', image: '/images/data/8410a2c5-26cd-4edb-b4f7-3faa83cab12b.png' },
  { id: 'anime', name: 'Anime cel-shading style', image: '/images/data/2e89fc3d-60bb-4ffa-b6bc-e3589cee6ace.jpg' },
  { id: 'cartoon', name: 'Cartoon style', image: '/images/data/3999e411-d3a3-4d15-8c72-baa0a91d25ec.jpg' },
  { id: '3d-chibi', name: '3D chibi diorama', image: '/images/data/10944cf4-5342-40c4-bcd4-b8eea061080d.jpg' },
  { id: 'watercolor', name: 'Watercolor painting', image: '/images/data/5dcbe524-4083-4d80-9631-8d2f88666a6c.jpg' },
  { id: 'oil-painting', name: 'Oil painting', image: '/images/data/fb0e99ec-ba47-46d2-8f5e-0643930e45d7.jpg' },
  { id: 'pencil-sketch', name: 'Detailed pencil sketch', image: '/images/data/0a638626-a5c4-4d60-8c75-a4adb3ef4ce1.jpg' },
  { id: 'comic', name: 'Comic book style illustration', image: '/images/data/a47ab538-f2c9-49dd-88b0-5dafac44b284.jpg' },
  { id: 'claymation', name: 'Claymation style', image: '/images/data/39961fa3-77d5-4a7e-a261-5dae744f4bc5.jpg' },
  { id: 'impressionist', name: 'Impressionist painting', image: '/images/data/8a1493af-4720-4306-a7a2-0ce6ed608e5b.jpg' },
  { id: 'toy-photo', name: 'Toy photograph style', image: '/images/data/ac84ce2f-c0cd-4609-bd15-d8e2f6591249.jpg' },
  { id: 'blueprint', name: 'Blueprint diagram style', image: '/images/data/c4002352-7830-4f4d-8209-d7c74fde46a6.jpg' },
];
