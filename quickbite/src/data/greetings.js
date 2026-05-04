// Note is : 7 unique daily greetings — changes every day of the week

const DAILY = [
  {
    // Sunday
    salutation: (name) => name ? `sunday energy, ${name} 😴` : `sunday energy 😴`,
    sub: {
      morning:   "bro it's Sunday morning. respect. you're already ahead of everyone still in bed.",
      afternoon: "Sunday afternoon and you're thinking about food? honestly a great decision.",
      evening:   "Sunday scaries hitting? food fixes everything, at least temporarily ngl.",
      night:     "Sunday night fuel-up before the week destroys you. smart move fr.",
    },
  },
  {
    // Monday
    salutation: (name) => name ? `monday didn't beat you, ${name} 💪` : `monday didn't beat you 💪`,
    sub: {
      morning:   "alarm went off, you got up, you're ordering food. that's called winning.",
      afternoon: "halfway through Monday. you deserve a proper meal, not just vibes.",
      evening:   "Monday evening unlocked. the hard part's over. eat something good.",
      night:     "survived Monday. that alone deserves a treat fr fr.",
    },
  },
  {
    // Tuesday
    salutation: (name) => name ? `hey ${name}, still standing 🫡` : `still standing 🫡`,
    sub: {
      morning:   "Tuesday morning hits different when your stomach is already plotting against you.",
      afternoon: "Not Monday, not Wednesday. just vibing through Tuesday with a hunger arc.",
      evening:   "Tuesday evening? underrated. food hits harder on underrated days.",
      night:     "Late Tuesday studying? your brain needs calories more than wifi rn.",
    },
  },
  {
    // Wednesday
    salutation: (name) => name ? `hump day, ${name} 🐪` : `hump day szn 🐪`,
    sub: {
      morning:   "Wednesday morning — you're literally in the middle of surviving the week.",
      afternoon: "Week is half done. lunch isn't optional, it's a personality trait.",
      evening:   "Wednesday evening and you made it this far. that deserves a good meal.",
      night:     "It's giving midweek midnight hunger. totally valid, we got you.",
    },
  },
  {
    // Thursday
    salutation: (name) => name ? `almost there, ${name} ⚡` : `almost there ⚡`,
    sub: {
      morning:   "Thursday. one more push. fuel up and make Friday fear you.",
      afternoon: "Thursday afternoon and the weekend is literally waving at you from a distance.",
      evening:   "Pre-Friday energy is real. good food = better Thursday night arc.",
      night:     "Thursday night grind? respect. food is the only thing keeping this going.",
    },
  },
  {
    // Friday
    salutation: (name) => name ? `it's FRIDAY, ${name} 🎉` : `it's FRIDAY 🎉`,
    sub: {
      morning:   "Friday morning and the whole vibe just shifted. treat yourself, you earned it.",
      afternoon: "Friday lunch hits different. like, the food even tastes better today.",
      evening:   "Friday evening unlocked. order something good, you carried the whole week.",
      night:     "Friday night and you're ordering food? main character behaviour, no notes.",
    },
  },
  {
    // Saturday
    salutation: (name) => name ? `weekend mode: on, ${name} 🔥` : `weekend mode: on 🔥`,
    sub: {
      morning:   "Saturday morning and you're already thinking about food. that's character development.",
      afternoon: "Saturday afternoon hunger is a different species. let's sort that out.",
      evening:   "Saturday evening hits different. good food, no lectures tomorrow. we're so back.",
      night:     "Saturday night snack run? iconic. legendary. no further questions.",
    },
  },
];

function getTimeKey(hour) {
  if (hour >= 5 && hour < 12)  return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function getGreeting(name) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day  = ist.getUTCDay();   
  const hour = ist.getUTCHours();

  const firstName = name ? name.trim().split(' ')[0].toLowerCase() : null;
  const entry = DAILY[day];

  return {
    salutation: entry.salutation(firstName),
    sub: entry.sub[getTimeKey(hour)],
  };
}