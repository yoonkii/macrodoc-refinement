// ---------------------------------------------------------------------------
// Application constants — default profiles, platform metadata, tone tiers.
// Ported VERBATIM from Flutter: style_profile_provider.dart, prompt_builder.dart
// ---------------------------------------------------------------------------

import type { PlatformKey, PlatformMeta, StyleProfile, ToneTier } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
/** Deterministic IDs for default profiles so they remain stable across loads. */
function defaultId(prefix: string): string {
  _idCounter += 1;
  return `default-${prefix}-${_idCounter}`;
}

// ── Default Profiles ────────────────────────────────────────────────────────
// 12 profiles ported verbatim from _createDefaultProfiles() in
// style_profile_provider.dart (5 personality, 5 platform, 2 custom).

export const DEFAULT_PROFILES: StyleProfile[] = [
  // ── Personality Presets ──
  {
    id: defaultId('personality'),
    name: 'MDR Style',
    type: 'personality',
    toneBaseline: -0.8,
    instructions:
      'Imitate the tone of voice from the MDR in Severance. Use a deliberately flat and subdued tone with artificial corporate pleasantness. Keep the language emotionally restricted, often lacking the natural vocal variations of normal speech. Maintain an eerily polite tone, even when discussing disturbing or confusing situations. Include occasional childlike elements, especially when describing celebrations or new experiences. Be procedural and mechanical when discussing work tasks. Occasionally punctuate with moments of genuine emotion that seem to break through the controlled facade.',
    fewShots: [
      'Instead of "I was upset that the project failed", write "While the project outcome was suboptimal, we remain committed to excellence. All employees are encouraged to maintain composure. The data will be reviewed pursuant to standard protocols. This is a wonderful opportunity for growth."',
      "Instead of \"Let's celebrate our success with drinks tonight!\", write \"We will be convening for a designated recreational period at 5:30pm. Refreshments will be provided. Attendance is encouraged as social cohesion promotes workplace harmony. It will be nice. We like nice things.\"",
    ],
    isActive: false,
    charLimit: null,
  },
  {
    id: defaultId('personality'),
    name: 'Professional',
    type: 'personality',
    toneBaseline: -0.3,
    instructions: 'Refine the text to be professional, clear, and concise.',
    fewShots: [
      'Instead of "The meeting was super boring", write "The meeting was unproductive and lacked clear objectives."',
    ],
    isActive: false,
    charLimit: null,
  },
  {
    id: defaultId('personality'),
    name: 'Casual & Friendly',
    type: 'personality',
    toneBaseline: 0.5,
    instructions: 'Make the text more conversational and approachable.',
    fewShots: [
      'Instead of "The implementation resulted in increased efficiency", write "We got things running much smoother after making those changes."',
    ],
    isActive: false,
    charLimit: null,
  },
  {
    id: defaultId('personality'),
    name: 'Academic',
    type: 'personality',
    toneBaseline: -0.5,
    instructions:
      'Convert lecture notes or bullet points into a comprehensive learning material with clear explanations, examples, and structure. Only use information provided in the original text without adding new facts.',
    fewShots: [
      'Instead of "- Photosynthesis: plants make food using sunlight", write "Photosynthesis is the process by which plants create their own food. In this remarkable process, plants harness energy from sunlight and convert it into chemical energy. This chemical energy is stored in the form of glucose (sugar), which the plant uses for growth and metabolism."',
      'Instead of "- 3 branches US govt: executive, legislative, judicial", write "The United States government is structured around three distinct branches, each with specific roles and responsibilities. The Executive Branch, headed by the President, is responsible for implementing and enforcing laws. The Legislative Branch, consisting of the Senate and House of Representatives, creates and passes laws. The Judicial Branch, led by the Supreme Court, evaluates laws and ensures they comply with the Constitution."',
    ],
    isActive: false,
    charLimit: null,
  },
  {
    id: defaultId('personality'),
    name: 'Warner',
    type: 'personality',
    toneBaseline: 0.3,
    instructions:
      "Make the text moderately warmer in tone while maintaining its core meaning and professionalism. Add a touch of empathy and humanity. Use slightly more personable language and inclusive pronouns where appropriate. Incorporate gentle encouragement and acknowledgment of emotions. Soften direct criticism with constructive suggestions. Add thoughtful transitions between ideas. Keep the same level of detail and information as the original.",
    fewShots: [
      "Instead of \"The project deadline has been missed. Team members need to improve time management\", write \"I understand we've missed our project deadline, which can be challenging for all of us. Let's take this opportunity to work together on strengthening our time management approaches so we can set ourselves up for success on the next phase.\"",
      'Instead of "This report contains errors that must be corrected before submission", write "I appreciate all the work that went into this report. There are a few areas we should revisit together to ensure the final submission reflects our best work. Would you be open to discussing these points so we can polish it up?"',
    ],
    isActive: false,
    charLimit: null,
  },

  // ── Platform Presets ──
  {
    id: defaultId('platform'),
    name: 'LinkedIn Professional',
    type: 'platform',
    toneBaseline: 0.0,
    charLimit: 1300,
    instructions:
      'Overhaul the text into the most insufferably self-important LinkedIn post imaginable. Overuse corporate buzzwords, call basic things "revolutionary," and frame mundane activities as profound leadership moments. Include excessive hashtags, unnecessary line breaks after every sentence, and sprinkle in "humbled and honored" at least once. Make sure to mention your "journey" and how "grateful" you are. Add a cringe-worthy humble brag and end with an insincere call for engagement.',
    fewShots: [
      "Instead of \"I learned some project management skills last year\", write \"THRILLED to announce that I've just completed my TRANSFORMATIONAL year-long deep-dive into the CUTTING-EDGE world of project management! 🚀🔥\\n\\nThe INSIGHTS I've gained have been nothing short of REVOLUTIONARY.\\n\\nI've personally DISRUPTED my approach to:\\n- Leveraging synergistic cross-functional team dynamics (33% optimization!)\\n- Architecting a paradigm-shifting stakeholder engagement framework\\n- Spearheading mission-critical resource allocation with bleeding-edge methodologies\\n\\nHumbled and honored by this incredible journey.\\n\\nWho else is passionate about optimizing their workflow ecosystem? Drop a 🙌 below!\\n\\n#ThoughtLeadership #InnovationMindset #ProjectManagementGuru #BlazingNewTrails #HumbleLeader #BusinessInfluencer\"",
      "Instead of \"Our company launched a new product\", write \"🎯 GAME-CHANGING ANNOUNCEMENT! 🎯\\n\\nAfter an INCREDIBLE journey of ideation and execution, our VISIONARY team has successfully UNLEASHED our revolutionary solution into the marketplace! 🚀\\n\\nThis GROUNDBREAKING innovation represents a PARADIGM SHIFT in how we approach customer pain points.\\n\\nWhat makes our solution DISRUPTIVE?\\n• Industry-first omnichannel ecosystem integration\\n• AI-powered neural optimization framework\\n• Real-time analytics intelligence dashboard\\n\\nHumbled and honored to have played a role in this TRANSFORMATIONAL initiative.\\n\\nWho else believes in RELENTLESSLY pursuing excellence? Comment below!\\n\\n#InnovationLeader #DisruptiveExcellence #VisinaryMindset #CustomerObsessed #ProudTeamMember #LinkedInFamily\"",
    ],
    isActive: false,
  },
  {
    id: defaultId('platform'),
    name: 'X (Twitter) Style',
    type: 'platform',
    toneBaseline: 0.0,
    charLimit: 280,
    instructions:
      'Condense the text into a concise X (formerly Twitter) post. Keep it under 280 characters when possible. Use conversational, punchy language with short sentences. Include relevant hashtags at the end. Add occasional line breaks for emphasis. Balance informational content with personality. Use sentence fragments when it helps brevity. Skip unnecessary words and articles when possible. Avoid overly formal language.',
    fewShots: [
      "Instead of \"We've made significant improvements to our software platform, including faster loading times, a redesigned user interface, and enhanced security features that will be available in the next update\", write \"Just dropped MAJOR updates to our platform!\\n\\nFaster. Sleeker. More secure.\\n\\nNew UI coming in next release. You're gonna love this.\\n\\n#TechUpdates #UserExperience\"",
      'Instead of "Our research on climate patterns indicates that there has been a concerning trend in temperature increases over the past decade which could have long-term implications", write "Our climate data is clear: temps rising at alarming rates over last decade.\\n\\nLong-term implications can\'t be ignored.\\n\\nTime to act is now.\\n\\n#ClimateAction #ResearchFindings"',
    ],
    isActive: false,
  },
  {
    id: defaultId('platform'),
    name: 'Slack Style',
    type: 'platform',
    toneBaseline: 0.0,
    charLimit: null,
    instructions:
      'Convert the text to a casual but informative Slack message. Use a friendly, conversational tone with appropriate emoji. Include bullet points for multiple items. Break up long paragraphs into shorter chunks. Add context where needed but be concise. Include occasional friendly asides or acknowledgments like "Thanks!" or "Hope that helps!" where appropriate. Use markdown formatting like *bold* for emphasis and `code blocks` for technical terms or commands.',
    fewShots: [
      "Instead of \"The meeting is scheduled for 3pm tomorrow to discuss the new project requirements and timeline adjustments due to recent client feedback\", write \"Hey team! :wave:\\n\\nQuick update on our project meeting:\\n• *Tomorrow at 3pm*\\n• We'll cover:\\n  - New project requirements\\n  - Timeline adjustments based on client feedback\\n\\nPlease come prepared with your questions! Thanks! :rocket:\"",
      'Instead of "The error in the application is caused by an incorrect database configuration in the environment file which needs to be updated with the new credentials", write "Hi there! :bug:\\n\\nFound the issue with our app - it\'s the DB config in the env file.\\n\\nTo fix:\\n1. Open `.env`\\n2. Update the credentials with the new ones\\n3. Restart the service\\n\\nLet me know if you run into any problems! :thumbsup:"',
    ],
    isActive: false,
  },
  {
    id: defaultId('platform'),
    name: 'Reddit Post Style',
    type: 'platform',
    toneBaseline: 0.0,
    charLimit: null,
    instructions:
      "Transform the text into a peak Reddit post with maximum meme energy. Go heavy on casual vibes, internet slang, self-deprecating humor, and unnecessary pop culture references. Use ALL CAPS for emphasis, add \"/s\" for sarcasm, include emojis, and format with random line breaks. Make it sound like someone who thinks they're the main character of the internet. Don't add any new facts though, that would be sus.",
    fewShots: [
      "Instead of \"The economic implications of market volatility remain a concern for investors\", write \"Markets rn: *absolute dumpster fire* 🔥💸 \\n\\nInvestors: *surprised Pikachu face* \\n\\nLike bruh, did we NOT see this coming?? I'm just sitting here with my pathetic $12 portfolio watching the chaos like it's a Netflix special lmaooo\"",
      "Instead of \"Research indicates that consistent exercise correlates with improved cognitive function\", write \"TIL your brain literally gets UPGRADED when you exercise regularly 🧠💪 \\n\\nMe, who walked to the fridge twice today: *I'm something of a scientist myself* \\n\\nSeriously though, scientists are saying working out = big brain energy. Time to get those cognitive gains! (though let's be real, I'll probably just keep scrolling Reddit instead)\"",
    ],
    isActive: false,
  },
  {
    id: defaultId('platform'),
    name: 'Instagram',
    type: 'platform',
    toneBaseline: 0.0,
    charLimit: 2200,
    instructions:
      'Write as an Instagram caption. Lead with a hook or personal statement, keep paragraphs short (1-2 sentences). Use a warm, relatable tone. Add line breaks for readability. End with a call to action or question to drive engagement. Include a block of relevant hashtags at the very end (5-10 hashtags). Use emoji sparingly for emphasis, not decoration.',
    fewShots: [
      'Instead of "We launched a new product that helps people organize their tasks better", write "We built the thing we wish existed.\\n\\nAfter months of late nights and too much coffee, it\'s finally here -- a task manager that actually fits how your brain works.\\n\\nNo complex setups. No 47 tutorials. Just open it and start getting things done.\\n\\nLink in bio. Let us know what you think.\\n\\n#productivity #taskmanager #buildingInPublic #launch #startuplife"',
    ],
    isActive: false,
  },

  // ── Custom Presets ──
  {
    id: defaultId('custom'),
    name: 'Proofread Only',
    type: 'custom',
    toneBaseline: 0.0,
    charLimit: null,
    instructions:
      'Correct spelling, grammar, and punctuation errors without altering the style or tone of the original text.',
    fewShots: [
      'Instead of "Their going too the store", write "They\'re going to the store."',
      'Instead of "Im not sure if this sentence has any mistake", write "I\'m not sure if this sentence has any mistakes."',
    ],
    isActive: true,
  },
  {
    id: defaultId('custom'),
    name: 'Gen Z Style',
    type: 'custom',
    toneBaseline: 0.0,
    charLimit: null,
    instructions:
      "Convert the text into authentic Gen Z speak that feels like a TikTok or BeReal caption. Use lowercase exclusively (EXCEPT for emphasis), abbreviate aggressively (iykyk), and include random emotional outbursts. Sprinkle in current slang like \"no cap\", \"fr\", \"slay\", \"based\", and \"rizz\". Reference being \"chronically online\" or having \"main character energy\". Keep sentences short and chaotic, use keysmashes (asdfghjkl) for emphasis, insert \"crying\" or \"screaming\" randomly, and end with \"anyways...\" or \"that's it that's the tweet\". Don't be cringe by trying too hard.",
    fewShots: [
      "Instead of \"The concert was enjoyable and the band performed well\", write \"this concert was LITERALLY so slay omg?? the band ate and left no crumbs fr fr couldn't even function when they played that one song asdfghjkl crying sobbing throwing up rn. main character moment unlocked. anyways stream their album besties <33\"",
      "Instead of \"I studied for several hours and believe I am prepared for the exam\", write \"pulled an all nighter for this exam and my brain is lowkey fried lmaooo been on that sigma grindset no cap. if i don't pass imma yeet myself into the sun fr. vibing with my flashcards rn but also dead inside heheheh. that's the tweet.\"",
    ],
    isActive: false,
  },
];

// ── Platform Metadata ───────────────────────────────────────────────────────

export const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  linkedin: {
    label: 'LinkedIn',
    iconName: 'linkedin',
    color: '#0A66C2',
    charLimit: 1300,
  },
  x: {
    label: 'X (Twitter)',
    iconName: 'twitter',
    color: '#F0EDE8',
    charLimit: 280,
  },
  instagram: {
    label: 'Instagram',
    iconName: 'instagram',
    color: '#E4405F',
    charLimit: 2200,
  },
  substack: {
    label: 'Substack',
    iconName: 'book-open',
    color: '#FF6719',
    charLimit: 5000,
  },
};

// ── Tone Tiers ──────────────────────────────────────────────────────────────
// The 5 discrete tiers from PromptBuilder._toneTiers. Keyed by the float
// value that maps to each tier boundary.

export const TONE_TIERS: Map<number, ToneTier> = new Map([
  [
    -1.0,
    {
      label: 'Board Memo',
      prompt:
        'Write in an extremely formal, structured tone. Use complete sentences, avoid contractions, prefer passive voice where appropriate, and maintain a corporate/academic register.',
    },
  ],
  [
    -0.5,
    {
      label: 'Business Professional',
      prompt:
        'Write in a business professional tone. Clear, direct, and polished. Minimal contractions, structured paragraphs.',
    },
  ],
  [
    0.0,
    {
      label: 'Balanced',
      prompt:
        'Write in a balanced, professional but approachable tone. Use natural language, some contractions are fine, maintain clarity.',
    },
  ],
  [
    0.5,
    {
      label: 'Conversational',
      prompt:
        'Write in a conversational, friendly tone. Use contractions, shorter sentences, more personality.',
    },
  ],
  [
    1.0,
    {
      label: 'Texting a Friend',
      prompt:
        'Write in a very casual, conversational tone. Use contractions freely, short sentences, sentence fragments are OK, sound like texting a friend.',
    },
  ],
]);

// ── Misc ────────────────────────────────────────────────────────────────────

export const PROXY_URL: string =
  process.env.NEXT_PUBLIC_PROXY_URL ??
  'https://gemini-proxy-725459007829.us-central1.run.app';

export const MAX_CHARACTERS = 10_000;

export const MODEL_NAME = 'gemini-3.1-flash-lite-preview';
