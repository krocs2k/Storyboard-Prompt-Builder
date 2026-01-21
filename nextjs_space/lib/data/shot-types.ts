export interface ShotType {
  id: string;
  name: string;
  image?: string;
}

export const shotTypes: ShotType[] = [
  { id: 'birds-eye', name: "BIRD'S-EYE VIEW" },
  { id: 'close-up', name: 'CLOSE UP', image: 'https://cdn.abacus.ai/images/88a55385-661c-491b-9f14-510e70aeb45f.png' },
  { id: 'cutaway', name: 'CUTAWAY SHOT' },
  { id: 'cowboy', name: 'COWBOY-SHOT' },
  { id: 'dutch-angle', name: 'DUTCH ANGLE', image: 'https://cdn.abacus.ai/images/8e050f61-b9f1-4332-944c-861ca711d030.jpg' },
  { id: 'entire-body', name: 'ENTIRE BODY' },
  { id: 'establishing', name: 'ESTABLISHING SHOT' },
  { id: 'extreme-close-up', name: 'EXTREME CLOSE UP' },
  { id: 'group', name: 'GROUP SHOT' },
  { id: 'headshot', name: 'HEADSHOT' },
  { id: 'high-angle', name: 'HIGH ANGLE SHOT' },
  { id: 'insert', name: 'INSERT SHOT' },
  { id: 'low-angle', name: 'LOW ANGLE SHOT' },
  { id: 'medium', name: 'MEDIUM SHOT' },
  { id: 'over-shoulder', name: 'OVER THE SHOULDER SHOT' },
  { id: 'overhead', name: 'OVERHEAD SHOT' },
  { id: 'pov', name: 'POINT OF VIEW SHOT' },
  { id: 'reaction', name: 'REACTION SHOT' },
  { id: 'reverse', name: 'REVERSE SHOT' },
  { id: 'three-quarter', name: 'THREE QUARTER BODY' },
  { id: 'tight-headshot', name: 'TIGHT HEADSHOT' },
  { id: 'two-shot', name: 'TWO-SHOT' },
  { id: 'upper-body', name: 'UPPER BODY' },
  { id: 'wide', name: 'WIDE SHOT', image: 'https://cdn.abacus.ai/images/ffa7d1b4-f9ff-4044-afcf-1ab645389299.jpg' },
  { id: 'worms-eye', name: "WORM'S-EYE VIEW" },
];
