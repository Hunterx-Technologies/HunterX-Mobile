import type { LegalDocument } from './types';

// Shown from Profile → Acknowledgements. Section 1's package list comes from
// assets/licenses.json (`npm run licenses`), rendered under its text.
// Update `lastUpdated` whenever the text changes.

export const ACKNOWLEDGEMENTS: LegalDocument = {
  title: 'Acknowledgements',
  lastUpdated: '27 October 2026',
  intro:
    'HunterX is built with the help of many open-source projects, services and creators. Thank you to everyone behind them.',
  sections: [
    {
      heading: 'Open-source software',
      paragraphs: [
        'HunterX uses open-source software under licences such as MIT, Apache 2.0, BSD and ISC. The full list of packages, versions and licence texts is shown below. Tap a package to read its licence.',
      ],
    },
    {
      heading: 'Technology and services',
      paragraphs: [],
      bullets: [
        'React and React Native, by Meta and the open-source community',
        'Expo and Expo Router, by Expo',
        'Firebase Cloud Messaging, by Google, for push notifications',
        'Apple Health (iOS) and Health Connect (Android), the platforms we read your health data from, only with your permission',
        'Google Sign-In and Sign in with Apple',
        'Cloudinary, for image storage and delivery',
        'Rive and Lottie, for in-app animations',
        'Railway, which hosts our servers',
      ],
    },
    {
      heading: 'Reward partner',
      paragraphs: ['Rewards in HunterX are provided by Gymgasm. Thank you for partnering with us.'],
    },
    {
      heading: 'Artwork and animations',
      paragraphs: [
        'In-app artwork, icons and animations are created by the HunterX team and licensed creators. Some artwork is created with the help of AI tools. Any third-party animation or icon is used under its creator’s licence.',
      ],
    },
    {
      heading: 'Trademarks',
      paragraphs: [
        'Apple, Apple Health and Sign in with Apple are trademarks of Apple Inc. Google, Google Play, Firebase and Health Connect are trademarks of Google LLC. All other names belong to their owners. HunterX is an independent app and is not affiliated with, sponsored by or endorsed by any of them, or by any other game, comic, film or series.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions about these acknowledgements, or a credit we missed? Write to us at customercare@hunterx.co.in.',
      ],
    },
  ],
};
