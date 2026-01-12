import { DigItem } from './types';

export const TOTAL_PADS = 16;
export const STEPS_PER_BAR = 16;

export const PAD_COLORS = [
  'bg-red-600', 'bg-orange-600', 'bg-amber-600', 'bg-yellow-600',
  'bg-lime-600', 'bg-green-600', 'bg-emerald-600', 'bg-teal-600',
  'bg-cyan-600', 'bg-sky-600', 'bg-blue-600', 'bg-indigo-600',
  'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-pink-600',
];

export const SAMPLE_SET_URL = 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/refs/heads/master/strudel.json';

export const MOCK_SOCIAL_FEED: DigItem[] = [
  {
    id: 'vid_1',
    type: 'video',
    thumbnail: 'https://picsum.photos/300/200?random=1',
    title: 'Neon Drum Solo',
    duration: '0:15',
    audioUrl: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808bd/BD0000.WAV', 
  },
  {
    id: 'vid_2',
    type: 'video',
    thumbnail: 'https://picsum.photos/300/200?random=2',
    title: 'Retro Synth Wave',
    duration: '0:10',
    audioUrl: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808sd/SD0000.WAV', 
  }
];

export const DEFAULT_SAMPLE_SETTINGS = {
  volume: 1.0,
  pitch: 1.0,
  pan: 0,
  start: 0,
  end: 1,
  filterCutoff: 20000,
  filterRes: 0,
};