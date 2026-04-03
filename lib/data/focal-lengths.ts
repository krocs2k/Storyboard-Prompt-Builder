export interface FocalLength {
  id: string;
  name: string;
  description: string;
  image?: string;
}

export const focalLengths: FocalLength[] = [
  { id: '35mm', name: '35mm Prime', description: 'natural perspective, slight wide look, minimal distortion, versatile storytelling, documentary aesthetic', image: '/images/data/869e17b5-67d1-4b6b-ade3-8c6b6f18feac.png' },
  { id: '50mm', name: '50mm Prime', description: 'standard field of view, natural compression, classic portrait look, neutral perspective, creamy bokeh', image: '/images/data/5a8b94da-3ac5-4456-9c81-5aaf3683f914.png' },
  { id: '85mm', name: '85mm Prime', description: 'short telephoto, flattering portrait compression, shallow depth of field, smooth background blur', image: '/images/data/6061cfe1-46d8-48b9-b624-31b52d89f0b8.png' },
  { id: '100mm', name: '100mm Macro', description: 'high magnification, extreme detail, shallow focus, scientific clarity, tight close-up framing', image: '/images/data/c4a0287e-ed42-4344-bd0f-2635885c4ffd.png' },
  { id: '135mm', name: '135mm Telephoto Prime', description: 'strong background compression, shallow DOF, telephoto isolation, cinematic portraits', image: '/images/data/ad5452ee-92e8-4dcd-8b33-e34f4a9e3eca.png' },
  { id: '24mm', name: '24mm Wide Prime', description: 'wide perspective, moderate distortion, environmental storytelling, dynamic framing', image: '/images/data/9aacdfb6-97b3-4714-995f-adb2a5cbd344.png' },
  { id: '14mm', name: '14mm Ultra-Wide Prime', description: 'dramatic distortion, expansive field of view, deep focus, architectural exaggeration', image: '/images/data/15366c85-8b26-4909-a064-61b8438e02a3.png' },
  { id: '200mm', name: '200mm Telephoto Prime', description: 'heavy compression, tight framing, shallow DOF, sports and wildlife style', image: '/images/data/9371c648-ef03-42ec-b2ae-74d68ba4dbad.png' },
];
