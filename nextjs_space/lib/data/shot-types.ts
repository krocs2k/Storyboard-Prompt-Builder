export interface ShotType {
  id: string;
  name: string;
  image?: string;
}

export const shotTypes: ShotType[] = [
  { id: 'birds-eye', name: "BIRD'S-EYE VIEW", image: 'https://cdn.abacus.ai/images/00d1d1c0-837e-4c2d-b2fb-e7799a754b5f.png' },
  { id: 'close-up', name: 'CLOSE UP', image: 'https://cdn.abacus.ai/images/88a55385-661c-491b-9f14-510e70aeb45f.png' },
  { id: 'cutaway', name: 'CUTAWAY SHOT', image: 'https://cdn.abacus.ai/images/a2242fce-82ce-46fd-bcf8-b59f5ad17305.png' },
  { id: 'cowboy', name: 'COWBOY-SHOT', image: 'https://cdn.abacus.ai/images/0043e270-5bfc-453e-a0ea-adc63e224cff.png' },
  { id: 'dutch-angle', name: 'DUTCH ANGLE', image: 'https://cdn.abacus.ai/images/8e050f61-b9f1-4332-944c-861ca711d030.jpg' },
  { id: 'entire-body', name: 'ENTIRE BODY', image: 'https://cdn.abacus.ai/images/8d963cc7-254f-40d2-9e3b-074cbc916c81.png' },
  { id: 'establishing', name: 'ESTABLISHING SHOT', image: 'https://cdn.abacus.ai/images/3dcba770-66af-437a-ac4f-893992caca0d.png' },
  { id: 'extreme-close-up', name: 'EXTREME CLOSE UP', image: 'https://cdn.abacus.ai/images/f23dfb6e-3fdb-4f0e-b534-47a5f990576f.png' },
  { id: 'group', name: 'GROUP SHOT', image: 'https://cdn.abacus.ai/images/13505d2a-c178-4dd2-a245-f63f3fbfc7a9.png' },
  { id: 'headshot', name: 'HEADSHOT', image: 'https://cdn.abacus.ai/images/4c3e8292-0121-4016-91f5-04fa59ddcc8a.png' },
  { id: 'high-angle', name: 'HIGH ANGLE SHOT', image: 'https://cdn.abacus.ai/images/b8650268-183a-41d3-b9e4-75c32f44992d.png' },
  { id: 'insert', name: 'INSERT SHOT', image: 'https://cdn.abacus.ai/images/b069eb5c-4da4-48e7-bd5b-d7a0dc700b19.png' },
  { id: 'low-angle', name: 'LOW ANGLE SHOT', image: 'https://cdn.abacus.ai/images/77b9d812-2a49-4e82-ba04-6e5c2b233409.png' },
  { id: 'medium', name: 'MEDIUM SHOT', image: 'https://cdn.abacus.ai/images/7197b10a-905c-4f65-8202-e4c6bf0f7aa4.png' },
  { id: 'over-shoulder', name: 'OVER THE SHOULDER SHOT', image: 'https://cdn.abacus.ai/images/ea9c53c5-859c-4bf6-8688-043d3ddb8266.png' },
  { id: 'overhead', name: 'OVERHEAD SHOT', image: 'https://cdn.abacus.ai/images/90d5cd71-a34c-45b1-a90e-c837f7c88434.png' },
  { id: 'pov', name: 'POINT OF VIEW SHOT', image: 'https://cdn.abacus.ai/images/c189fbc0-ed44-4852-92b6-81f1a3e93005.png' },
  { id: 'reaction', name: 'REACTION SHOT' },
  { id: 'reverse', name: 'REVERSE SHOT' },
  { id: 'three-quarter', name: 'THREE QUARTER BODY' },
  { id: 'tight-headshot', name: 'TIGHT HEADSHOT' },
  { id: 'two-shot', name: 'TWO-SHOT' },
  { id: 'upper-body', name: 'UPPER BODY' },
  { id: 'wide', name: 'WIDE SHOT', image: 'https://cdn.abacus.ai/images/ffa7d1b4-f9ff-4044-afcf-1ab645389299.jpg' },
  { id: 'worms-eye', name: "WORM'S-EYE VIEW" },
];
