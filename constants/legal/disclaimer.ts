import type { LegalDocument } from './types';

// Shown from Profile → Disclaimer. Update `lastUpdated` whenever the text
// changes.

export const DISCLAIMER: LegalDocument = {
  title: 'Disclaimer',
  lastUpdated: '27 October 2026',
  intro:
    'Please read this Disclaimer carefully before using HunterX. By using the app you agree to it. If you do not agree, please do not use HunterX.',
  sections: [
    {
      heading: 'Not medical advice',
      paragraphs: [
        'HunterX is a motivation and habit-tracking app. Its quests, goals, tips and other content are for general information and motivation only. They are not medical, health, fitness or nutrition advice, and they do not replace advice from a doctor or other qualified professional.',
        'Talk to a doctor before starting any new exercise, diet or activity routine, especially if you:',
      ],
      bullets: [
        'have a heart, lung, joint or other medical condition, or an injury',
        'are pregnant, recently gave birth, or are breastfeeding',
        'take medication, or have been advised to limit physical activity',
        'have not exercised for a long time',
      ],
      footer:
        'Stop immediately and seek medical help if you feel pain, dizziness, shortness of breath, chest discomfort or any other unusual symptom. In an emergency, call your local emergency number (112 in India).',
    },
    {
      heading: 'Exercise at your own risk',
      paragraphs: [
        'Quests and challenges are general activities, not a programme designed for you. You decide whether an activity is safe and suitable for you, and you take part voluntarily and at your own risk.',
        'Use proper technique, suitable equipment and a safe place, and stay aware of your surroundings — for example traffic or weather when walking or running outdoors. Never put yourself or others at risk to complete a quest, keep a streak or earn XP or rewards.',
      ],
    },
    {
      heading: 'Health and activity data',
      paragraphs: [
        'If you connect Health Connect (Android) or Apple Health (iOS), HunterX reads steps, distance, active calories, heart rate, sleep and workouts recorded by your phone, watch and other apps. These figures come from those sources and are estimates; they may be incomplete, delayed or inaccurate.',
        'Your BMI and your daily step, water and protein goals are calculated from the details you enter and are general guidelines, not medical targets. HunterX is not a medical device and must not be used to diagnose, treat, monitor or prevent any disease or condition.',
      ],
    },
    {
      heading: 'No guaranteed results',
      paragraphs: [
        'Results depend on many things outside our control, including your health, genetics, consistency, diet and sleep. Any example, story or progress shown in the app is not a promise that you will achieve the same results.',
      ],
    },
    {
      heading: 'XP, levels, streaks and leaderboards',
      paragraphs: [
        'XP, levels, ranks, streaks, streak lives, badges and leaderboard positions are game features with no cash or monetary value. They cannot be sold, transferred or exchanged for money. We may adjust them to correct errors, keep things fair, or address misuse.',
      ],
    },
    {
      heading: 'Rewards, coupons and partner offers',
      paragraphs: [
        'Scratch cards, coupons and other rewards may be offered by third-party brands. Each reward is subject to the partner’s own terms, including eligibility, minimum order value, availability and expiry date.',
      ],
      bullets: [
        'Rewards have no cash value and cannot be exchanged for cash or transferred unless the partner allows it.',
        'Rewards are limited in number and can run out; a reward is only confirmed once revealed in the app.',
        'The partner, not HunterX, is responsible for its products, services, delivery, refunds and support.',
        'We may change, pause or withdraw rewards at any time, including where we suspect misuse.',
        'Apple and Google are not sponsors of, and are not involved in, any reward.',
      ],
    },
    {
      heading: 'Paid quests',
      paragraphs: [
        'A paid quest gives you access to that quest’s content and its reward for the period shown at purchase. Payment does not guarantee any fitness result. Prices, refunds and access are explained at the time of purchase.',
      ],
    },
    {
      heading: 'Photos and proof you submit',
      paragraphs: [
        'Some quests ask for photo proof. Only upload photos you have the right to share, and do not include other people without their consent. Approval of proof is at our discretion, and XP or rewards are only given once proof is approved.',
      ],
    },
    {
      heading: 'Third-party services',
      paragraphs: [
        'HunterX works with services run by others, such as Google, Apple, Health Connect, Apple Health and our reward partners. We do not control them and are not responsible for their content, availability or privacy practices. Their own terms and policies apply.',
      ],
    },
    {
      heading: 'Who can use HunterX',
      paragraphs: [
        'HunterX is intended for adults aged 18 and over. By using the app you confirm that you are 18 or older and are able to take part in physical activity safely.',
      ],
    },
    {
      heading: 'Availability and accuracy',
      paragraphs: [
        'We work to keep HunterX accurate and available, but the app is provided “as is” and “as available”. We do not guarantee that it will always be error-free, uninterrupted or up to date, and features may change.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, Hunterx Technologies and its team are not liable for any injury, illness, loss or damage arising from your use of the app, your participation in any activity, your reliance on its content or data, or any reward or service provided by a third party. Nothing in this Disclaimer limits any liability that cannot be limited under applicable law.',
        'This Disclaimer forms part of our Terms of Service. If the two conflict, the Terms of Service apply.',
      ],
    },
    {
      heading: 'Changes to this Disclaimer',
      paragraphs: [
        'We may update this Disclaimer from time to time. The date at the top shows when it last changed. Continuing to use HunterX after an update means you accept the updated Disclaimer.',
      ],
    },
    {
      heading: 'Contact us',
      paragraphs: ['Questions about this Disclaimer? Write to us at customercare@hunterx.co.in.'],
    },
  ],
};
