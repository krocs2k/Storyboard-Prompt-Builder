export interface GenrePersona {
  role: string;
  background: string;
}

export interface StoryGenre {
  id: string;
  name: string;
  description: string;
  icon: string;
  personas?: GenrePersona[];
}

const PROMO_AD_PERSONAS: GenrePersona[] = [
  {
    role: 'Award-Winning Marketing Expert',
    background: 'Emmy and Clio Award-winning marketing strategist with 20+ years leading campaigns for Fortune 500 brands. Specializes in brand storytelling, audience psychology, and campaign architecture that drives measurable engagement and conversion.'
  },
  {
    role: 'Master Copywriting Expert',
    background: 'Legendary direct-response and brand copywriter behind billion-dollar campaigns. Expert in persuasion frameworks (AIDA, PAS, StoryBrand), headline craft, emotional triggers, and converting viewers into customers through the power of words.'
  },
  {
    role: 'Elite Sales Expert',
    background: 'Top-performing sales strategist and closer with deep expertise in consumer behavior, objection handling, value proposition design, and crafting irresistible offers. Understands the psychology of why people buy and how to structure narratives that move audiences to action.'
  },
  {
    role: 'Digital Media Expert',
    background: 'Pioneering digital media producer and platform strategist. Expert in social-first video content, attention economics, algorithmic distribution, YouTube/TikTok/Instagram ad formats, and creating scroll-stopping content optimized for every screen size and platform.'
  },
  {
    role: 'Strategic Communications Expert',
    background: 'Award-winning PR and communications leader with expertise in brand voice, messaging hierarchy, audience segmentation, crisis communication, and crafting narratives that build trust, authority, and lasting brand equity across all media channels.'
  }
];

export const storyGenres: StoryGenre[] = [
  { id: 'action', name: 'Action', description: 'High-energy fights and explosive sequences', icon: '💥' },
  { id: 'advertisement', name: 'Advertisement', description: 'Commercial spots, ad campaigns, and persuasive sales content', icon: '📺', personas: PROMO_AD_PERSONAS },
  { id: 'adventure', name: 'Adventure', description: 'Epic journeys and daring expeditions', icon: '🗺️' },
  { id: 'alien', name: 'Alien Encounter', description: 'Extraterrestrial contact and invasion', icon: '👽' },
  { id: 'animated-action', name: 'Kids Animated Action', description: 'Saturday-morning hero teams and toy-line adventures (G.I. Joe, Voltron, Thundercats)', icon: '🛡️' },
  { id: 'anthology', name: 'Anthology', description: 'Collection of short interconnected tales', icon: '📚' },
  { id: 'buddy-animals', name: 'Buddy Animals', description: 'Lovable animal pals on small daily adventures (Bluey, Paw Patrol)', icon: '🐾' },
  { id: 'classic-cartoon', name: 'Classic Cartoon', description: 'Zany slapstick gags and rubber-hose humor (Animaniacs, Looney Tunes, Smurfs)', icon: '🎨' },
  { id: 'comedy', name: 'Comedy', description: 'Humorous and lighthearted entertainment', icon: '😂' },
  { id: 'coming-of-age', name: 'Coming of Age', description: 'Youth transitions and self-discovery', icon: '🌱' },
  { id: 'conspiracy', name: 'Conspiracy', description: 'Government secrets and cover-ups', icon: '🕵️' },
  { id: 'crime', name: 'Crime', description: 'Criminal underworlds and law enforcement', icon: '🚔' },
  { id: 'cryptid', name: 'Cryptid', description: 'Bigfoot, Mothman, and legendary creatures', icon: '🐾' },
  { id: 'documentary', name: 'Documentary Style', description: 'Realistic, interview-based storytelling', icon: '📹' },
  { id: 'drama', name: 'Drama', description: 'Emotional human experiences and conflicts', icon: '🎭' },
  { id: 'dystopian', name: 'Dystopian', description: 'Dark futures and oppressive societies', icon: '🏚️' },
  { id: 'edutainment', name: 'Edutainment', description: 'Learning through fun characters and songs (Sesame Street, Curious George)', icon: '🎓' },
  { id: 'espionage', name: 'Espionage', description: 'Spy games and international intrigue', icon: '🕶️' },
  { id: 'fairy-tale', name: 'Fairy Tale', description: 'Classic storybook quests with princesses, knights, and talking creatures', icon: '🧚' },
  { id: 'family', name: 'Family Drama', description: 'Domestic conflicts and relationships', icon: '👨‍👩‍👧' },
  { id: 'fantasy', name: 'Fantasy', description: 'Magical worlds and mythical creatures', icon: '🧙' },
  { id: 'fantasy-kids', name: 'Kids Sword & Sorcery', description: 'Heroic young warriors in mystical lands (He-Man, Thundercats, Avatar)', icon: '⚔️' },
  { id: 'noir', name: 'Film Noir', description: 'Dark, cynical crime stories', icon: '🎩' },
  { id: 'folk-horror', name: 'Folk Horror', description: 'Rural terrors and ancient rituals', icon: '🌾' },
  { id: 'found-footage', name: 'Found Footage', description: 'Discovered recordings and tapes', icon: '📼' },
  { id: 'haunted', name: 'Haunted House', description: 'Possessed locations and trapped souls', icon: '🏚️' },
  { id: 'heist', name: 'Heist', description: 'Elaborate robberies and clever schemes', icon: '💎' },
  { id: 'historical', name: 'Historical', description: 'Stories set in significant past eras', icon: '🏛️' },
  { id: 'horror', name: 'Horror', description: 'Fear-inducing tales of terror and dread', icon: '👻' },
  { id: 'kids-comedy', name: 'Kids Comedy', description: 'Silly chaos, gross-out gags, and goofy heroes (SpongeBob, Teen Titans Go)', icon: '🤪' },
  { id: 'kids-fantasy', name: 'Kids Fantasy Quest', description: 'Magical kid heroes saving whimsical worlds (Smurfs, Rainbow Brite)', icon: '🌈' },
  { id: 'kids-mystery', name: 'Kids Mystery', description: 'Junior detective sleuthing and clue-hunting (Scooby-Doo, Encyclopedia Brown)', icon: '🔎' },
  { id: 'kids-school', name: 'School Days', description: 'Friendships, classroom hijinks, and growing up (Arthur, Recess, Hey Arnold!)', icon: '🎒' },
  { id: 'kids-sports', name: 'Kids Sports', description: 'Underdog teams chasing the championship (Mighty Ducks, Bend It Like Beckham)', icon: '⚽' },
  { id: 'mecha-kids', name: 'Mecha & Robots', description: 'Giant robots and mech-suit heroes (Voltron, Transformers, Power Rangers)', icon: '🤖' },
  { id: 'monster', name: 'Monster', description: 'Creature features and beast attacks', icon: '🦖' },
  { id: 'musical', name: 'Musical', description: 'Song-driven narratives and performances', icon: '🎵' },
  { id: 'mystery', name: 'Mystery', description: 'Puzzling crimes and detective investigations', icon: '🔍' },
  { id: 'paranormal', name: 'Paranormal', description: 'Unexplained phenomena and psychic abilities', icon: '🔮' },
  { id: 'possession', name: 'Possession', description: 'Demonic entities and exorcisms', icon: '😈' },
  { id: 'post-apocalyptic', name: 'Post-Apocalyptic', description: 'Survival after global catastrophe', icon: '☢️' },
  { id: 'preschool', name: 'Preschool', description: 'Gentle, comforting stories for the youngest viewers (Mr. Rogers, Teletubbies, Sesame Street)', icon: '🧸' },
  { id: 'promo', name: 'Promo', description: 'Promotional videos, brand stories, and product showcases', icon: '📣', personas: PROMO_AD_PERSONAS },
  { id: 'psychological', name: 'Psychological', description: 'Mind-bending and mentally challenging', icon: '🧠' },
  { id: 'revenge', name: 'Revenge', description: 'Vengeance and retribution stories', icon: '⚡' },
  { id: 'romance', name: 'Romance', description: 'Love stories and relationship drama', icon: '💕' },
  { id: 'sci-fi', name: 'Science Fiction', description: 'Futuristic technology and space exploration', icon: '🚀' },
  { id: 'slasher', name: 'Slasher', description: 'Serial killers and survival horror', icon: '🔪' },
  { id: 'slice-of-life-kids', name: 'Slice of Life (Kids)', description: 'Wholesome everyday family moments (Bluey, Peppa Pig, Doc McStuffins)', icon: '🏡' },
  { id: 'sports', name: 'Sports', description: 'Athletic competition and triumph', icon: '🏆' },
  { id: 'superhero-kids', name: 'Kid Superhero', description: 'Young capes, sidekicks, and squad-up team-ups (Teen Titans Go, PJ Masks, Miraculous)', icon: '🦸' },
  { id: 'supernatural', name: 'Supernatural', description: 'Ghosts, spirits, and otherworldly beings', icon: '👁️' },
  { id: 'survival', name: 'Survival', description: 'Fighting against nature and odds', icon: '🏕️' },
  { id: 'talking-animals', name: 'Talking Animals', description: 'Anthropomorphic critters with big personalities (Curious George, Berenstain Bears)', icon: '🐵' },
  { id: 'thriller', name: 'Thriller', description: 'Suspenseful and heart-pounding narratives', icon: '🔪' },
  { id: 'time-travel', name: 'Time Travel', description: 'Journeys through past and future', icon: '⏰' },
  { id: 'toy-vehicle', name: 'Toy & Vehicle Tales', description: 'Friendly trains, cars, and toys come to life (Thomas the Tank Engine, Cars, Toy Story)', icon: '🚂' },
  { id: 'war', name: 'War', description: 'Military conflicts and battle narratives', icon: '⚔️' },
  { id: 'western', name: 'Western', description: 'Old West cowboys and frontier justice', icon: '🤠' },
];
