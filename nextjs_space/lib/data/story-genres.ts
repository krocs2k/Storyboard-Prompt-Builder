export interface StoryGenre {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const storyGenres: StoryGenre[] = [
  { id: 'horror', name: 'Horror', description: 'Fear-inducing tales of terror and dread', icon: '👻' },
  { id: 'sci-fi', name: 'Science Fiction', description: 'Futuristic technology and space exploration', icon: '🚀' },
  { id: 'fantasy', name: 'Fantasy', description: 'Magical worlds and mythical creatures', icon: '🧙' },
  { id: 'thriller', name: 'Thriller', description: 'Suspenseful and heart-pounding narratives', icon: '🔪' },
  { id: 'mystery', name: 'Mystery', description: 'Puzzling crimes and detective investigations', icon: '🔍' },
  { id: 'romance', name: 'Romance', description: 'Love stories and relationship drama', icon: '💕' },
  { id: 'drama', name: 'Drama', description: 'Emotional human experiences and conflicts', icon: '🎭' },
  { id: 'comedy', name: 'Comedy', description: 'Humorous and lighthearted entertainment', icon: '😂' },
  { id: 'action', name: 'Action', description: 'High-energy fights and explosive sequences', icon: '💥' },
  { id: 'adventure', name: 'Adventure', description: 'Epic journeys and daring expeditions', icon: '🗺️' },
  { id: 'crime', name: 'Crime', description: 'Criminal underworlds and law enforcement', icon: '🚔' },
  { id: 'supernatural', name: 'Supernatural', description: 'Ghosts, spirits, and otherworldly beings', icon: '👁️' },
  { id: 'paranormal', name: 'Paranormal', description: 'Unexplained phenomena and psychic abilities', icon: '🔮' },
  { id: 'psychological', name: 'Psychological', description: 'Mind-bending and mentally challenging', icon: '🧠' },
  { id: 'historical', name: 'Historical', description: 'Stories set in significant past eras', icon: '🏛️' },
  { id: 'war', name: 'War', description: 'Military conflicts and battle narratives', icon: '⚔️' },
  { id: 'western', name: 'Western', description: 'Old West cowboys and frontier justice', icon: '🤠' },
  { id: 'noir', name: 'Film Noir', description: 'Dark, cynical crime stories', icon: '🎩' },
  { id: 'dystopian', name: 'Dystopian', description: 'Dark futures and oppressive societies', icon: '🏚️' },
  { id: 'post-apocalyptic', name: 'Post-Apocalyptic', description: 'Survival after global catastrophe', icon: '☢️' },
  { id: 'alien', name: 'Alien Encounter', description: 'Extraterrestrial contact and invasion', icon: '👽' },
  { id: 'monster', name: 'Monster', description: 'Creature features and beast attacks', icon: '🦖' },
  { id: 'slasher', name: 'Slasher', description: 'Serial killers and survival horror', icon: '🔪' },
  { id: 'haunted', name: 'Haunted House', description: 'Possessed locations and trapped souls', icon: '🏚️' },
  { id: 'possession', name: 'Possession', description: 'Demonic entities and exorcisms', icon: '😈' },
  { id: 'cryptid', name: 'Cryptid', description: 'Bigfoot, Mothman, and legendary creatures', icon: '🐾' },
  { id: 'conspiracy', name: 'Conspiracy', description: 'Government secrets and cover-ups', icon: '🕵️' },
  { id: 'espionage', name: 'Espionage', description: 'Spy games and international intrigue', icon: '🕶️' },
  { id: 'survival', name: 'Survival', description: 'Fighting against nature and odds', icon: '🏕️' },
  { id: 'revenge', name: 'Revenge', description: 'Vengeance and retribution stories', icon: '⚡' },
  { id: 'heist', name: 'Heist', description: 'Elaborate robberies and clever schemes', icon: '💎' },
  { id: 'coming-of-age', name: 'Coming of Age', description: 'Youth transitions and self-discovery', icon: '🌱' },
  { id: 'family', name: 'Family Drama', description: 'Domestic conflicts and relationships', icon: '👨‍👩‍👧' },
  { id: 'sports', name: 'Sports', description: 'Athletic competition and triumph', icon: '🏆' },
  { id: 'musical', name: 'Musical', description: 'Song-driven narratives and performances', icon: '🎵' },
  { id: 'documentary', name: 'Documentary Style', description: 'Realistic, interview-based storytelling', icon: '📹' },
  { id: 'found-footage', name: 'Found Footage', description: 'Discovered recordings and tapes', icon: '📼' },
  { id: 'anthology', name: 'Anthology', description: 'Collection of short interconnected tales', icon: '📚' },
  { id: 'time-travel', name: 'Time Travel', description: 'Journeys through past and future', icon: '⏰' },
  { id: 'folk-horror', name: 'Folk Horror', description: 'Rural terrors and ancient rituals', icon: '🌾' }
];
