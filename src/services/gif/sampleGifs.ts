export interface SampleGif {
  id: string;
  name: string;
  uri: string;
  thumbnail: string;
  duration: string;
  frames: number;
}

export const SAMPLE_GIFS: SampleGif[] = [
  {
    id: 'sample_cat',
    name: 'Curious Cat',
    uri: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    thumbnail: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    duration: '00:03',
    frames: 24
  },
  {
    id: 'sample_runner',
    name: 'Running Man',
    uri: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    thumbnail: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
    duration: '00:02',
    frames: 18
  },
  {
    id: 'sample_dog',
    name: 'Happy Puppy',
    uri: 'https://media.giphy.com/media/4Zo41lhzKt6iZ8xff9/giphy.gif',
    thumbnail: 'https://media.giphy.com/media/4Zo41lhzKt6iZ8xff9/giphy.gif',
    duration: '00:04',
    frames: 32
  }
];
