export interface FocalLength {
  id: string;
  name: string;
  description: string;
}

export const focalLengths: FocalLength[] = [
  { id: '35mm', name: '35mm Prime', description: 'natural perspective, slight wide look, minimal distortion, versatile storytelling, documentary aesthetic' },
  { id: '50mm', name: '50mm Prime', description: 'standard field of view, natural compression, classic portrait look, neutral perspective, creamy bokeh' },
  { id: '85mm', name: '85mm Prime', description: 'short telephoto, flattering portrait compression, shallow depth of field, smooth background blur' },
  { id: '100mm', name: '100mm Macro', description: 'high magnification, extreme detail, shallow focus, scientific clarity, tight close-up framing' },
  { id: '135mm', name: '135mm Telephoto Prime', description: 'strong background compression, shallow DOF, telephoto isolation, cinematic portraits' },
  { id: '24mm', name: '24mm Wide Prime', description: 'wide perspective, moderate distortion, environmental storytelling, dynamic framing' },
  { id: '14mm', name: '14mm Ultra-Wide Prime', description: 'dramatic distortion, expansive field of view, deep focus, architectural exaggeration' },
  { id: '200mm', name: '200mm Telephoto Prime', description: 'heavy compression, tight framing, shallow DOF, sports and wildlife style' },
];
