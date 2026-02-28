import React, { useMemo, useState } from "react";

/**
 * Exercise Library (Remade)
 * - Clean, scalable data model
 * - Uses your downloaded image structure (categories/, thumbs/, and per-body-part folders)
 * - Replaces emojis with lightweight inline SVG icons (no extra deps)
 * - Fixes thumbnail paths to use /thumbs/ wherever available
 *
 * Expected folder root:
 * public/images/exercises/...
 */

// ===================== TYPES =====================

type ExerciseCategory =
  | "Neck"
  | "Shoulders"
  | "Arms"
  | "Hands & Wrist"
  | "Chest"
  | "Back"
  | "Core"
  | "Legs"
  | "Thighs"
  | "Glutes"
  | "Calves"
  | "Ankles & Feet"
  | "Toes"
  | "Full Body"
  | "Cardio"
  | "Yoga"
  | "Stretching";

type Difficulty = "Beginner" | "Intermediate" | "Advanced";

type Equipment =
  | "None"
  | "Mat"
  | "Dumbbells"
  | "Resistance Band"
  | "Chair"
  | "Wall"
  | "Yoga Block"
  | "Towel";

type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: Difficulty;
  equipment: Equipment[];
  duration: string; // e.g., "30 sec", "1 min", "10 reps"
  sets: number;
  reps: string;
  restBetween: string;

  description: string;
  benefits: string[];
  primaryMuscles: string[];
  secondaryMuscles?: string[];

  thumbnail: string; // prefers /thumbs/ if available
  images: {
    stepByStep: string[];
  };

  /** Optional: can be empty string if not available yet */
  videoUrl?: string;

  steps: string[];
  formTips: string[];
  commonMistakes?: string[];
  contraindications?: string[];
  modifications?: {
    easier?: string;
    harder?: string;
  };

  tags: string[];
};

type CategoryCard = {
  category: ExerciseCategory;
  title: string;
  description: string;
  /** Category banner image from /categories/ */
  image: string;
  /** Icon key for SVG icon mapping */
  iconKey: IconName;
  /** Tailwind gradient or any CSS string (kept as-is, used in your CSS) */
  color: string;
  benefits: string[];
};

// ===================== ASSET HELPERS =====================

const ASSET_ROOT = "/images/exercises";

const folderByCategory: Record<ExerciseCategory, string> = {
  Neck: "neck",
  Shoulders: "shoulders",
  Arms: "arms",
  "Hands & Wrist": "hands",
  Chest: "chest",
  Back: "back",
  Core: "core",
  Legs: "legs",
  Thighs: "thighs",
  Glutes: "glutes",
  Calves: "calves",
  "Ankles & Feet": "ankles",
  Toes: "toes",
  "Full Body": "fullbody",
  Cardio: "cardio",
  Yoga: "yoga",
  Stretching: "stretching",
};

const img = {
  cat: (filename: string) => `${ASSET_ROOT}/categories/${filename}`,
  thumb: (filename: string) => `${ASSET_ROOT}/thumbs/${filename}`,
  step: (category: ExerciseCategory, filename: string) =>
    `${ASSET_ROOT}/${folderByCategory[category]}/${filename}`,
  fallback: () => `${ASSET_ROOT}/thumbs/ex-placeholder.webp`,
};

function safeImg(src?: string): string {
  return src && src.trim() ? src : img.fallback();
}

// ===================== ICONS (NO EMOJIS) =====================

type IconName =
  | "grid"
  | "search"
  | "x"
  | "reset"
  | "clock"
  | "repeat"
  | "rest"
  | "play"
  | "close"
  | "list"
  | "target"
  | "shield"
  | "swap"
  | "category"
  | "neck"
  | "shoulders"
  | "arms"
  | "hands"
  | "chest"
  | "back"
  | "core"
  | "legs"
  | "thighs"
  | "glutes"
  | "calves"
  | "ankles"
  | "toes"
  | "fullbody"
  | "cardio"
  | "yoga"
  | "stretching";

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className: className ?? "ex-ico",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M16.5 16.5 21 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "x":
    case "close":
      return (
        <svg {...common}>
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <path
            d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
            fill="currentColor"
          />
        </svg>
      );
    case "reset":
      return (
        <svg {...common}>
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 4v6h-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <path
            d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common}>
          <path
            d="M7 7h10v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 17H7v-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 11l2-2-2-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 13l-2 2 2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "rest":
      return (
        <svg {...common}>
          <path
            d="M7 4v16M7 16h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 6h7a3 3 0 0 1 0 6h-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path
            d="M9 7l10 5-10 5V7Z"
            fill="currentColor"
          />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path
            d="M8 6h13M8 12h13M8 18h13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M3 6h.01M3 12h.01M3 18h.01"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <path
            d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M12 2l8 4v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "swap":
      return (
        <svg {...common}>
          <path
            d="M7 7h11l-3-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 17H6l3 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "category":
      return (
        <svg {...common}>
          <path
            d="M4 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    // body-part icons (simple + consistent)
    case "neck":
    case "shoulders":
    case "arms":
    case "hands":
    case "chest":
    case "back":
    case "core":
    case "legs":
    case "thighs":
    case "glutes":
    case "calves":
    case "ankles":
    case "toes":
    case "fullbody":
    case "cardio":
    case "yoga":
    case "stretching":
      return (
        <svg {...common}>
          <path
            d="M12 3c2.2 0 4 1.8 4 4 0 1.3-.6 2.4-1.5 3.1M12 3c-2.2 0-4 1.8-4 4 0 1.3.6 2.4 1.5 3.1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M7 21c.5-4 2.5-6 5-6s4.5 2 5 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 12c2-1 4-1.5 6-1.5S16 11 18 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );
    default:
      return null;
  }
}

// ===================== CATEGORY CARDS (WITH BANNERS) =====================

const CATEGORIES_BASE: Omit<CategoryCard, "benefits"> & { benefits: string[] }[] = [
  {
    category: "Neck",
    title: "Neck",
    description: "Tension relief + mobility",
    image: img.cat("cat-neck.webp"),
    iconKey: "neck",
    color: "from-blue-400 to-indigo-500",
    benefits: ["Tension relief", "Better posture", "Less stiffness"],
  },
  {
    category: "Shoulders",
    title: "Shoulders",
    description: "Warm-up + joint health",
    image: img.cat("cat-shoulders.webp"),
    iconKey: "shoulders",
    color: "from-purple-400 to-pink-500",
    benefits: ["Mobility", "Rotator cuff health", "Upper-body prep"],
  },
  {
    category: "Arms",
    title: "Arms",
    description: "Biceps + triceps strength",
    image: img.cat("cat-arms.webp"),
    iconKey: "arms",
    color: "from-red-400 to-orange-500",
    benefits: ["Arm strength", "Definition", "Grip support"],
  },
  {
    category: "Hands & Wrist",
    title: "Hands & Wrist",
    description: "Dexterity + wrist health",
    image: img.cat("cat-hands.webp"),
    iconKey: "hands",
    color: "from-amber-400 to-yellow-500",
    benefits: ["Wrist mobility", "Carpal tunnel prevention", "Dexterity"],
  },
  {
    category: "Chest",
    title: "Chest",
    description: "Push strength + opening",
    image: img.cat("cat-chest.webp"),
    iconKey: "chest",
    color: "from-emerald-400 to-teal-500",
    benefits: ["Pushing power", "Posture", "Upper body strength"],
  },
  {
    category: "Back",
    title: "Back",
    description: "Spine health + posture",
    image: img.cat("cat-back.webp"),
    iconKey: "back",
    color: "from-indigo-400 to-blue-500",
    benefits: ["Spinal mobility", "Posture", "Back strength"],
  },
  {
    category: "Core",
    title: "Core",
    description: "Stability + abs",
    image: img.cat("cat-core.webp"),
    iconKey: "core",
    color: "from-orange-400 to-red-500",
    benefits: ["Stability", "Back support", "Stronger abs"],
  },
  {
    category: "Legs",
    title: "Legs",
    description: "Strength + balance",
    image: img.cat("cat-legs.webp"),
    iconKey: "legs",
    color: "from-green-400 to-emerald-500",
    benefits: ["Lower body power", "Balance", "Functional strength"],
  },
  {
    category: "Thighs",
    title: "Thighs",
    description: "Inner + outer thigh work",
    image: img.cat("cat-thighs.webp"),
    iconKey: "thighs",
    color: "from-lime-400 to-green-500",
    benefits: ["Adductor strength", "Hip stability", "Leg definition"],
  },
  {
    category: "Glutes",
    title: "Glutes",
    description: "Activation + shaping",
    image: img.cat("cat-glutes.webp"),
    iconKey: "glutes",
    color: "from-pink-400 to-rose-500",
    benefits: ["Hip stability", "Better posture", "Glute strength"],
  },
  {
    category: "Calves",
    title: "Calves",
    description: "Ankle strength + stretch",
    image: img.cat("cat-calves.webp"),
    iconKey: "calves",
    color: "from-cyan-400 to-sky-500",
    benefits: ["Ankle stability", "Better running", "Calf flexibility"],
  },
  {
    category: "Ankles & Feet",
    title: "Ankles & Feet",
    description: "Mobility + foot strength",
    image: img.cat("cat-ankle.webp"),
    iconKey: "ankles",
    color: "from-violet-400 to-purple-500",
    benefits: ["Mobility", "Injury prevention", "Balance"],
  },
  {
    category: "Toes",
    title: "Toes",
    description: "Foot control + balance",
    image: img.cat("cat-toes.webp"),
    iconKey: "toes",
    color: "from-fuchsia-400 to-pink-500",
    benefits: ["Better balance", "Foot health", "Toe control"],
  },
  {
    category: "Full Body",
    title: "Full Body",
    description: "Total conditioning",
    image: img.cat("cat-fullbody.webp"),
    iconKey: "fullbody",
    color: "from-yellow-400 to-amber-500",
    benefits: ["Calorie burn", "Endurance", "Efficiency"],
  },
  {
    category: "Cardio",
    title: "Cardio",
    description: "Heart + stamina",
    image: img.cat("cat-cardio.webp"),
    iconKey: "cardio",
    color: "from-red-400 to-rose-500",
    benefits: ["Stamina", "Heart health", "Fat loss support"],
  },
  {
    category: "Yoga",
    title: "Yoga",
    description: "Flexibility + control",
    image: img.cat("cat-yoga.webp"),
    iconKey: "yoga",
    color: "from-purple-400 to-violet-500",
    benefits: ["Flexibility", "Mind-body control", "Recovery"],
  },
  {
    category: "Stretching",
    title: "Stretching",
    description: "Mobility + recovery",
    image: img.cat("cat-stretching.webp"),
    iconKey: "stretching",
    color: "from-blue-400 to-indigo-500",
    benefits: ["Better mobility", "Recovery", "Injury prevention"],
  },
];

// ===================== EXERCISE DB (USING YOUR DOWNLOADED FILES) =====================

/**
 * NOTE about videoUrl:
 * You didn’t share final YouTube links here, so videoUrl is left optional.
 * Once you have links, replace videoUrl with the real one per exercise.
 */
const EXERCISES: Exercise[] = [
  // ===== NECK =====
  {
    id: "neck-tilt",
    name: "Neck Tilt",
    category: "Neck",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec each side",
    sets: 2,
    reps: "5–8 each side",
    restBetween: "15 sec",
    description: "Gentle side-to-side tilt to release tension and improve neck flexibility.",
    benefits: ["Relieves stiffness", "Improves range of motion", "Desk posture support"],
    primaryMuscles: ["Upper Trapezius", "Scalenes", "Sternocleidomastoid"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: {
      stepByStep: [img.step("Neck", "neck-tilt-1.webp"), img.step("Neck", "neck-tilt-2.webp")],
    },
    steps: [
      "Sit or stand tall with shoulders relaxed.",
      "Tilt your head to one side (ear toward shoulder).",
      "Hold briefly, return to center, then repeat on the other side.",
    ],
    formTips: ["Keep shoulders down", "Move slowly", "Stretch—don’t force"],
    tags: ["neck", "mobility", "stretch", "desk"],
  },
  {
    id: "neck-rotation",
    name: "Neck Rotation",
    category: "Neck",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec each side",
    sets: 2,
    reps: "5–8 each side",
    restBetween: "15 sec",
    description: "Gentle turning to improve neck mobility and reduce stiffness.",
    benefits: ["Better rotation range", "Stiffness relief"],
    primaryMuscles: ["Sternocleidomastoid", "Splenius Capitis"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: {
      stepByStep: [
        img.step("Neck", "neck-rotation-1.webp"),
        img.step("Neck", "neck-rotation-2.webp"),
      ],
    },
    steps: ["Sit tall.", "Turn head to one side.", "Return slowly.", "Repeat other side."],
    formTips: ["Chin level", "No jerking"],
    tags: ["neck", "rotation", "mobility"],
  },
  {
    id: "neck-flexion",
    name: "Neck Flexion",
    category: "Neck",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec",
    sets: 2,
    reps: "5 controlled reps",
    restBetween: "15 sec",
    description: "Chin-to-chest movement to stretch the back of the neck.",
    benefits: ["Tech-neck relief", "Gentle stretch"],
    primaryMuscles: ["Upper Trapezius", "Cervical extensors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Neck", "neck-flex-1.webp")] },
    steps: ["Sit tall.", "Bring chin toward chest slowly.", "Return to neutral."],
    formTips: ["Slow control", "Shoulders relaxed"],
    tags: ["neck", "flexion", "mobility"],
  },
  {
    id: "neck-extension",
    name: "Neck Extension",
    category: "Neck",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec",
    sets: 2,
    reps: "5 controlled reps",
    restBetween: "15 sec",
    description: "Gentle upward tilt to stretch the front of the neck.",
    benefits: ["Front-neck opening", "Posture support"],
    primaryMuscles: ["Sternocleidomastoid", "Deep neck flexors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Neck", "neck-ext-1.webp")] },
    steps: ["Sit tall.", "Tilt head back gently.", "Return to neutral."],
    formTips: ["Don’t compress", "Small range is fine"],
    tags: ["neck", "extension", "mobility"],
  },
  {
    id: "upper-trap-stretch",
    name: "Upper Trap Stretch",
    category: "Neck",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30–45 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Releases common neck-shoulder tension area.",
    benefits: ["Tension release", "Better posture", "Stress tightness relief"],
    primaryMuscles: ["Upper Trapezius", "Levator Scapulae"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Neck", "upper-trap-1.webp"), img.step("Neck", "upper-trap-2.webp")] },
    steps: ["Tilt head to side.", "Optional: gentle hand pressure.", "Hold and breathe.", "Switch sides."],
    formTips: ["Minimal pressure", "Shoulders down"],
    tags: ["neck", "stretch", "traps", "desk"],
  },

  // ===== SHOULDERS =====
  {
    id: "shoulder-rolls",
    name: "Shoulder Rolls",
    category: "Shoulders",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "10 forward + 10 backward",
    restBetween: "15 sec",
    description: "Quick shoulder warm-up to improve mobility and circulation.",
    benefits: ["Mobility", "Warm-up", "Tension release"],
    primaryMuscles: ["Deltoids", "Upper Trapezius"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Shoulders", "shoulder-rolls-1.webp"), img.step("Shoulders", "shoulder-rolls-2.webp")] },
    steps: ["Roll shoulders forward.", "Roll shoulders backward."],
    formTips: ["Slow and controlled", "Breathe"],
    tags: ["shoulders", "warmup", "mobility"],
  },
  {
    id: "arm-circles",
    name: "Arm Circles",
    category: "Shoulders",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "10 small + 10 large each direction",
    restBetween: "15 sec",
    description: "Dynamic shoulder warm-up to prepare for upper-body work.",
    benefits: ["Warms shoulders", "Improves circulation"],
    primaryMuscles: ["Deltoids", "Rotator cuff"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Shoulders", "arm-circles-1.webp"), img.step("Shoulders", "arm-circles-2.webp")] },
    steps: ["Arms out at shoulder height.", "Make circles small then large.", "Reverse direction."],
    formTips: ["Core tight", "Arms straight (not locked)"],
    tags: ["shoulders", "warmup", "arms"],
  },

  // ===== ARMS =====
  {
    id: "bicep-curls",
    name: "Bicep Curls",
    category: "Arms",
    difficulty: "Beginner",
    equipment: ["Dumbbells"],
    duration: "2 min",
    sets: 3,
    reps: "10–12",
    restBetween: "45 sec",
    description: "Classic biceps strengthening movement.",
    benefits: ["Biceps strength", "Arm definition"],
    primaryMuscles: ["Biceps Brachii", "Brachialis"],
    thumbnail: img.thumb("ex-bicep-curl.webp"),
    images: { stepByStep: [img.step("Arms", "bicep-curls-1.webp"), img.step("Arms", "bicep-curls-2.webp")] },
    steps: ["Stand tall with dumbbells.", "Curl up with control.", "Lower slowly."],
    formTips: ["No swinging", "Elbows close to body"],
    tags: ["arms", "biceps", "strength"],
  },
  {
    id: "tricep-dips",
    name: "Tricep Dips",
    category: "Arms",
    difficulty: "Beginner",
    equipment: ["Chair"],
    duration: "2 min",
    sets: 3,
    reps: "8–12",
    restBetween: "45 sec",
    description: "Bodyweight tricep exercise using a stable chair.",
    benefits: ["Triceps strength", "Tones back of arms"],
    primaryMuscles: ["Triceps Brachii"],
    secondaryMuscles: ["Anterior Deltoid", "Chest"],
    thumbnail: img.thumb("ex-tricep-dip.webp"),
    images: { stepByStep: [img.step("Arms", "tricep-dips-1.webp"), img.step("Arms", "tricep-dips-2.webp")] },
    steps: ["Hands on chair edge.", "Lower elbows to ~90°.", "Push back up."],
    formTips: ["Elbows point back", "Shoulders down"],
    tags: ["arms", "triceps", "home"],
  },

  // ===== HANDS & WRIST =====
  {
    id: "wrist-flexor-stretch",
    name: "Wrist Flexor Stretch",
    category: "Hands & Wrist",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "15 sec",
    description: "Stretches inner forearm and wrist flexors.",
    benefits: ["Wrist comfort", "Typing/gaming support"],
    primaryMuscles: ["Wrist flexors"],
    thumbnail: img.thumb("ex-wrist-stretch.webp"),
    images: { stepByStep: [img.step("Hands & Wrist", "wrist-flexor-1.webp"), img.step("Hands & Wrist", "wrist-flexor-2.webp")] },
    steps: ["Arm forward, palm up.", "Gently pull fingers down.", "Hold and switch."],
    formTips: ["Gentle pull only", "Elbow straight (not locked)"],
    tags: ["wrist", "stretch", "forearm"],
  },
  {
    id: "wrist-extensor-stretch",
    name: "Wrist Extensor Stretch",
    category: "Hands & Wrist",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "15 sec",
    description: "Stretches outer forearm and wrist extensors.",
    benefits: ["Forearm relief", "Balanced wrist mobility"],
    primaryMuscles: ["Wrist extensors"],
    thumbnail: img.thumb("ex-wrist-stretch.webp"),
    images: { stepByStep: [img.step("Hands & Wrist", "wrist-extensor-1.webp"), img.step("Hands & Wrist", "wrist-extensor-2.webp")] },
    steps: ["Arm forward, palm down.", "Gently pull fingers down.", "Hold and switch."],
    formTips: ["Shoulders relaxed", "No pain"],
    tags: ["wrist", "stretch", "forearm"],
  },
  {
    id: "finger-walking",
    name: "Finger Walking",
    category: "Hands & Wrist",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "5 walks each hand",
    restBetween: "15 sec",
    description: "Improves finger dexterity and fine motor control.",
    benefits: ["Dexterity", "Hand coordination"],
    primaryMuscles: ["Finger flexors/extensors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Hands & Wrist", "finger-walking-1.webp"), img.step("Hands & Wrist", "finger-walking-2.webp")] },
    steps: ["Hand flat on table.", "Walk fingers forward then back.", "Switch hands."],
    formTips: ["One finger at a time", "Keep palm down"],
    tags: ["hands", "fingers", "dexterity"],
  },

  // ===== CHEST =====
  {
    id: "push-ups",
    name: "Push-Ups",
    category: "Chest",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "3 min",
    sets: 3,
    reps: "8–15",
    restBetween: "60 sec",
    description: "Compound push exercise for chest, shoulders, triceps + core stability.",
    benefits: ["Upper body strength", "Core engagement"],
    primaryMuscles: ["Pectoralis Major"],
    secondaryMuscles: ["Triceps", "Anterior Deltoid", "Core"],
    thumbnail: img.thumb("ex-pushup.webp"),
    images: { stepByStep: [img.step("Chest", "push-ups-1.webp"), img.step("Chest", "push-ups-2.webp"), img.step("Chest", "push-ups-3.webp")] },
    steps: ["Plank position.", "Lower chest with control.", "Press up."],
    formTips: ["Body straight line", "Elbows ~45°", "Breathe"],
    commonMistakes: ["Hips sagging", "Elbows flaring", "Half reps"],
    tags: ["chest", "strength", "bodyweight"],
  },
  {
    id: "wall-pushups",
    name: "Wall Push-Ups",
    category: "Chest",
    difficulty: "Beginner",
    equipment: ["Wall"],
    duration: "2 min",
    sets: 3,
    reps: "10–15",
    restBetween: "30 sec",
    description: "Beginner-friendly push-up progression using a wall.",
    benefits: ["Safe strength building", "Low wrist load"],
    primaryMuscles: ["Pectoralis Major"],
    secondaryMuscles: ["Triceps", "Shoulders"],
    thumbnail: img.thumb("ex-wall-pushup.webp"),
    images: { stepByStep: [img.step("Chest", "wall-pushups-1.webp"), img.step("Chest", "wall-pushups-2.webp")] },
    steps: ["Hands on wall.", "Lean and lower.", "Push back."],
    formTips: ["Straight body", "Adjust distance for difficulty"],
    tags: ["chest", "beginner", "wall"],
  },
  {
    id: "chest-stretch",
    name: "Chest Stretch",
    category: "Chest",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "30–45 sec",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Opens tight chest and improves shoulder positioning.",
    benefits: ["Better posture", "Reduced tightness"],
    primaryMuscles: ["Pectoralis Major", "Pectoralis Minor"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Chest", "chest-stretch-1.webp"), img.step("Chest", "chest-stretch-2.webp")] },
    steps: ["Arms on doorway/frame.", "Lean forward gently.", "Hold and breathe."],
    formTips: ["Don’t arch lower back", "Gentle stretch"],
    tags: ["chest", "stretch", "posture"],
  },

  // ===== BACK =====
  {
    id: "cat-cow",
    name: "Cat-Cow",
    category: "Back",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 2,
    reps: "10 cycles",
    restBetween: "20 sec",
    description: "Spinal mobility flow for warm-up and stiffness relief.",
    benefits: ["Spine mobility", "Back relief"],
    primaryMuscles: ["Erector Spinae", "Core"],
    thumbnail: img.thumb("ex-cat-cow.webp"),
    images: { stepByStep: [img.step("Back", "cat-cow-1.webp"), img.step("Back", "cat-cow-2.webp")] },
    steps: ["Hands and knees.", "Round spine (cat).", "Arch spine (cow).", "Flow with breath."],
    formTips: ["Move with breath", "Shoulders away from ears"],
    tags: ["back", "mobility", "warmup"],
  },
  {
    id: "childs-pose",
    name: "Child's Pose",
    category: "Back",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "1–2 min",
    sets: 1,
    reps: "Hold",
    restBetween: "N/A",
    description: "Restorative stretch for back, hips, and shoulders.",
    benefits: ["Relaxation", "Back stretch"],
    primaryMuscles: ["Lats", "Erector Spinae"],
    thumbnail: img.thumb("ex-child-pose.webp"),
    images: { stepByStep: [img.step("Back", "childs-pose-1.webp"), img.step("Back", "childs-pose-2.webp")] },
    steps: ["Kneel.", "Sit hips to heels.", "Fold forward.", "Breathe."],
    formTips: ["Relax neck", "Let gravity stretch you"],
    tags: ["back", "stretch", "recovery"],
  },
  {
    id: "superman",
    name: "Superman",
    category: "Back",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "10–12",
    restBetween: "45 sec",
    description: "Posterior-chain strength for back + glutes.",
    benefits: ["Posture strength", "Back endurance"],
    primaryMuscles: ["Erector Spinae", "Glutes", "Hamstrings"],
    thumbnail: img.thumb("ex-superman.webp"),
    images: { stepByStep: [img.step("Back", "superman-1.webp"), img.step("Back", "superman-2.webp")] },
    steps: ["Lie face down.", "Lift arms + legs.", "Hold briefly.", "Lower with control."],
    formTips: ["Neck neutral", "Lift with muscles, not swing"],
    tags: ["back", "strength", "posture"],
  },

  // ===== CORE =====
  {
    id: "plank",
    name: "Plank",
    category: "Core",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "30–90 sec",
    sets: 3,
    reps: "Hold",
    restBetween: "45 sec",
    description: "Core stability hold training the entire midsection.",
    benefits: ["Core strength", "Spine support"],
    primaryMuscles: ["Transversus Abdominis", "Rectus Abdominis", "Obliques"],
    thumbnail: img.thumb("ex-plank.webp"),
    images: { stepByStep: [img.step("Core", "plank-1.webp"), img.step("Core", "plank-2.webp")] },
    steps: ["Forearms on floor.", "Toes down.", "Body straight.", "Hold."],
    formTips: ["No hip sag", "Breathe steadily"],
    tags: ["core", "stability", "abs"],
  },
  {
    id: "crunches",
    name: "Crunches",
    category: "Core",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "15–20",
    restBetween: "30 sec",
    description: "Targets upper abs with controlled trunk flexion.",
    benefits: ["Upper abs strength"],
    primaryMuscles: ["Rectus Abdominis"],
    thumbnail: img.thumb("ex-crunches.webp"),
    images: { stepByStep: [img.step("Core", "crunches-1.webp"), img.step("Core", "crunches-2.webp")] },
    steps: ["Lie down.", "Curl shoulders up.", "Lower slowly."],
    formTips: ["Don’t pull neck", "Exhale up"],
    tags: ["core", "abs", "beginner"],
  },
  {
    id: "russian-twists",
    name: "Russian Twists",
    category: "Core",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "20 total",
    restBetween: "45 sec",
    description: "Rotation-based core drill focusing on obliques.",
    benefits: ["Oblique strength", "Rotation control"],
    primaryMuscles: ["Obliques"],
    thumbnail: img.thumb("ex-russian-twist.webp"),
    images: { stepByStep: [img.step("Core", "russian-twists-1.webp"), img.step("Core", "russian-twists-2.webp")] },
    steps: ["Sit and lean back.", "Rotate right then left.", "Keep core tight."],
    formTips: ["Chest proud", "Controlled twists"],
    tags: ["core", "obliques", "rotation"],
  },
  {
    id: "leg-raises",
    name: "Leg Raises",
    category: "Core",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "12–15",
    restBetween: "45 sec",
    description: "Lower abs + hip flexors, with controlled lowering.",
    benefits: ["Lower abs strength"],
    primaryMuscles: ["Lower Rectus Abdominis", "Hip Flexors"],
    thumbnail: img.thumb("ex-leg-raises.webp"),
    images: { stepByStep: [img.step("Core", "leg-raises-1.webp"), img.step("Core", "leg-raises-2.webp")] },
    steps: ["Lie down.", "Lift legs to ~90°.", "Lower slowly without arching back."],
    formTips: ["Press lower back down", "Reduce range if needed"],
    tags: ["core", "lower abs"],
  },

  // ===== LEGS =====
  {
    id: "squats",
    name: "Squats",
    category: "Legs",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "3 min",
    sets: 3,
    reps: "12–15",
    restBetween: "45 sec",
    description: "Foundational lower-body pattern for strength and mobility.",
    benefits: ["Leg strength", "Functional movement"],
    primaryMuscles: ["Quadriceps", "Glutes", "Hamstrings"],
    thumbnail: img.thumb("ex-squat.webp"),
    images: { stepByStep: [img.step("Legs", "squats-1.webp"), img.step("Legs", "squats-2.webp"), img.step("Legs", "squats-3.webp")] },
    steps: ["Feet shoulder-width.", "Sit hips back and down.", "Stand by driving through heels."],
    formTips: ["Knees track over toes", "Chest up"],
    tags: ["legs", "squat", "glutes", "quads"],
  },
  {
    id: "lunges",
    name: "Lunges",
    category: "Legs",
    difficulty: "Intermediate",
    equipment: ["None"],
    duration: "3 min",
    sets: 3,
    reps: "10–12 each side",
    restBetween: "45 sec",
    description: "Single-leg strength + balance builder.",
    benefits: ["Balance", "Glute and quad strength"],
    primaryMuscles: ["Quadriceps", "Glutes", "Hamstrings"],
    thumbnail: img.thumb("ex-lunges.webp"),
    images: { stepByStep: [img.step("Legs", "lunges-1.webp"), img.step("Legs", "lunges-2.webp")] },
    steps: ["Step forward.", "Lower to 90° knees.", "Push back to start.", "Switch side."],
    formTips: ["Torso upright", "Front knee over ankle"],
    tags: ["legs", "lunges", "balance"],
  },
  {
    id: "calf-raises",
    name: "Calf Raises",
    category: "Legs",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "2 min",
    sets: 3,
    reps: "15–20",
    restBetween: "30 sec",
    description: "Strengthens calf muscles for ankle stability.",
    benefits: ["Ankle stability", "Calf strength"],
    primaryMuscles: ["Gastrocnemius", "Soleus"],
    thumbnail: img.thumb("ex-calf-raises.webp"),
    images: { stepByStep: [img.step("Legs", "calf-raises-1.webp"), img.step("Legs", "calf-raises-2.webp")] },
    steps: ["Stand tall.", "Rise onto toes.", "Lower slowly."],
    formTips: ["Full range", "Control both up/down"],
    tags: ["legs", "calves"],
  },

  // ===== THIGHS =====
  {
    id: "inner-thigh-lifts",
    name: "Inner Thigh Lifts",
    category: "Thighs",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "15 each side",
    restBetween: "30 sec",
    description: "Targets inner thigh adductors.",
    benefits: ["Adductor strength", "Leg stability"],
    primaryMuscles: ["Adductors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Thighs", "inner-thigh-1.webp"), img.step("Thighs", "inner-thigh-2.webp")] },
    steps: ["Lie on side.", "Lift bottom leg up.", "Lower with control.", "Switch side."],
    formTips: ["Hips stacked", "Slow reps"],
    tags: ["thighs", "inner thighs"],
  },
  {
    id: "outer-thigh-lifts",
    name: "Outer Thigh Lifts",
    category: "Thighs",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "15 each side",
    restBetween: "30 sec",
    description: "Targets outer thighs and hip abductors.",
    benefits: ["Hip stability", "Glute medius activation"],
    primaryMuscles: ["Gluteus Medius", "Tensor Fasciae Latae"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Thighs", "outer-thigh-1.webp"), img.step("Thighs", "outer-thigh-2.webp")] },
    steps: ["Lie on side.", "Lift top leg.", "Lower slowly.", "Switch side."],
    formTips: ["Don’t rotate hips", "Feel side-hip work"],
    tags: ["thighs", "outer thighs", "hips"],
  },

  // ===== GLUTES =====
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    category: "Glutes",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "15–20",
    restBetween: "45 sec",
    description: "Glute activation staple for hip extension strength.",
    benefits: ["Glute activation", "Hip strength", "Back support"],
    primaryMuscles: ["Gluteus Maximus", "Hamstrings"],
    thumbnail: img.thumb("ex-glute-bridge.webp"),
    images: { stepByStep: [img.step("Glutes", "glute-bridge-1.webp"), img.step("Glutes", "glute-bridge-2.webp")] },
    steps: ["Lie down knees bent.", "Drive hips up.", "Squeeze glutes.", "Lower slowly."],
    formTips: ["Drive through heels", "Don’t over-arch"],
    tags: ["glutes", "bridge", "hips"],
  },
  {
    id: "donkey-kicks",
    name: "Donkey Kicks",
    category: "Glutes",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "15 each side",
    restBetween: "30 sec",
    description: "Glute isolation movement focusing on hip extension.",
    benefits: ["Glute targeting", "Hip extension"],
    primaryMuscles: ["Gluteus Maximus"],
    thumbnail: img.thumb("ex-donkey-kick.webp"),
    images: { stepByStep: [img.step("Glutes", "donkey-kicks-1.webp"), img.step("Glutes", "donkey-kicks-2.webp")] },
    steps: ["All-fours position.", "Kick heel up.", "Squeeze glute.", "Switch side."],
    formTips: ["Keep hips square", "Don’t swing lower back"],
    tags: ["glutes", "donkey kick"],
  },

  // ===== CALVES =====
  {
    id: "calf-stretch",
    name: "Calf Stretch",
    category: "Calves",
    difficulty: "Beginner",
    equipment: ["Wall"],
    duration: "45 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Wall calf stretch for ankle flexibility and tight calf relief.",
    benefits: ["Ankle mobility", "Tightness relief"],
    primaryMuscles: ["Gastrocnemius", "Soleus"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Calves", "calf-stretch-1.webp"), img.step("Calves", "calf-stretch-2.webp")] },
    steps: ["Hands on wall.", "Step one foot back.", "Heel down.", "Hold and switch."],
    formTips: ["Back leg straight (gastroc)", "Slight bend (soleus)"],
    tags: ["calves", "stretch", "ankle"],
  },

  // ===== ANKLES & FEET =====
  {
    id: "ankle-circles",
    name: "Ankle Circles",
    category: "Ankles & Feet",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "10 each direction each foot",
    restBetween: "15 sec",
    description: "Ankle mobility circles to warm up and improve range of motion.",
    benefits: ["Mobility", "Warm-up", "Injury prevention"],
    primaryMuscles: ["Tibialis Anterior", "Peroneals"],
    thumbnail: img.thumb("ex-ankle-circles.webp"),
    images: { stepByStep: [img.step("Ankles & Feet", "ankle-circles-1.webp"), img.step("Ankles & Feet", "ankle-circles-2.webp")] },
    steps: ["Lift foot.", "Circle ankle clockwise.", "Circle counterclockwise.", "Switch foot."],
    formTips: ["Controlled circles", "Comfortable range"],
    tags: ["ankles", "feet", "mobility"],
  },
  {
    id: "toe-curls",
    name: "Toe Curls",
    category: "Ankles & Feet",
    difficulty: "Beginner",
    equipment: ["Towel"],
    duration: "1 min",
    sets: 2,
    reps: "10–15",
    restBetween: "20 sec",
    description: "Strengthens foot muscles and supports arch function.",
    benefits: ["Foot strength", "Arch support"],
    primaryMuscles: ["Intrinsic foot muscles"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Ankles & Feet", "toe-curls-1.webp"), img.step("Ankles & Feet", "toe-curls-2.webp")] },
    steps: ["Foot on towel.", "Curl toes to scrunch towel.", "Release and repeat."],
    formTips: ["Use toes only", "Slow control"],
    tags: ["feet", "toes", "arch"],
  },

  // ===== TOES =====
  {
    id: "toe-spreads",
    name: "Toe Spreads",
    category: "Toes",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "10 each foot",
    restBetween: "15 sec",
    description: "Improves toe mobility and supports balance.",
    benefits: ["Toe mobility", "Balance support"],
    primaryMuscles: ["Toe abductors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Toes", "toe-spreads-1.webp"), img.step("Toes", "toe-spreads-2.webp")] },
    steps: ["Spread toes wide.", "Hold briefly.", "Relax and repeat."],
    formTips: ["Try barefoot", "Control the spread"],
    tags: ["toes", "feet", "balance"],
  },
  {
    id: "toe-yoga",
    name: "Toe Yoga",
    category: "Toes",
    difficulty: "Intermediate",
    equipment: ["None"],
    duration: "1 min",
    sets: 2,
    reps: "10 each pattern",
    restBetween: "20 sec",
    description: "Advanced toe control patterns for foot strength and coordination.",
    benefits: ["Foot control", "Stronger feet"],
    primaryMuscles: ["Toe extensors/flexors"],
    thumbnail: img.thumb("ex-placeholder.webp"),
    images: { stepByStep: [img.step("Toes", "toe-yoga-1.webp"), img.step("Toes", "toe-yoga-2.webp")] },
    steps: ["Lift big toe only.", "Then lift other toes only.", "Alternate."],
    formTips: ["Start slow", "Use hand assist if needed"],
    tags: ["toes", "control", "balance"],
  },

  // ===== FULL BODY =====
  {
    id: "burpees",
    name: "Burpees",
    category: "Full Body",
    difficulty: "Advanced",
    equipment: ["Mat"],
    duration: "3 min",
    sets: 3,
    reps: "8–12",
    restBetween: "60 sec",
    description: "High-intensity full-body conditioning move.",
    benefits: ["Conditioning", "Calorie burn", "Full-body power"],
    primaryMuscles: ["Full body"],
    thumbnail: img.thumb("ex-burpee.webp"),
    images: { stepByStep: [img.step("Full Body", "burpees-1.webp"), img.step("Full Body", "burpees-2.webp"), img.step("Full Body", "burpees-3.webp")] },
    steps: ["Stand.", "Squat to hands.", "Kick to plank.", "Return and jump."],
    formTips: ["Land softly", "Step-back option for beginners"],
    tags: ["fullbody", "hiit", "advanced"],
  },
  {
    id: "jumping-jacks",
    name: "Jumping Jacks",
    category: "Full Body",
    difficulty: "Beginner",
    equipment: ["None"],
    duration: "2 min",
    sets: 3,
    reps: "30–60 sec",
    restBetween: "30 sec",
    description: "Simple cardio warm-up using whole body.",
    benefits: ["Warm-up", "Heart rate boost"],
    primaryMuscles: ["Full body"],
    thumbnail: img.thumb("ex-jumping-jack.webp"),
    images: { stepByStep: [img.step("Full Body", "jumping-jacks-1.webp"), img.step("Full Body", "jumping-jacks-2.webp")] },
    steps: ["Jump feet apart while raising arms.", "Jump back to start.", "Repeat."],
    formTips: ["Soft landings", "Steady rhythm"],
    tags: ["fullbody", "cardio", "warmup"],
  },

  // ===== CARDIO =====
  {
    id: "high-knees",
    name: "High Knees",
    category: "Cardio",
    difficulty: "Intermediate",
    equipment: ["None"],
    duration: "2 min",
    sets: 3,
    reps: "30–60 sec",
    restBetween: "30 sec",
    description: "Runs in place with high knee drive to elevate heart rate.",
    benefits: ["Stamina", "Hip flexor drive"],
    primaryMuscles: ["Hip flexors", "Quads"],
    thumbnail: img.thumb("ex-high-knees.webp"),
    images: { stepByStep: [img.step("Cardio", "high-knees-1.webp"), img.step("Cardio", "high-knees-2.webp")] },
    steps: ["Stand tall.", "Drive knees up alternately.", "Pump arms."],
    formTips: ["Upright torso", "Soft feet"],
    tags: ["cardio", "hiit", "conditioning"],
  },
  {
    id: "mountain-climbers",
    name: "Mountain Climbers",
    category: "Cardio",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "2 min",
    sets: 3,
    reps: "30–60 sec",
    restBetween: "30 sec",
    description: "Plank-based cardio + core drill.",
    benefits: ["Cardio", "Core engagement"],
    primaryMuscles: ["Core", "Shoulders", "Hip flexors"],
    thumbnail: img.thumb("ex-mountain-climber.webp"),
    images: { stepByStep: [img.step("Cardio", "mountain-climbers-1.webp"), img.step("Cardio", "mountain-climbers-2.webp")] },
    steps: ["Plank position.", "Drive knees alternately.", "Keep hips stable."],
    formTips: ["Don’t bounce hips", "Hands under shoulders"],
    tags: ["cardio", "core", "hiit"],
  },

  // ===== YOGA =====
  {
    id: "downward-dog",
    name: "Downward Dog",
    category: "Yoga",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "45–90 sec",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Foundational yoga pose stretching posterior chain and shoulders.",
    benefits: ["Hamstring stretch", "Shoulder strength", "Back lengthening"],
    primaryMuscles: ["Hamstrings", "Calves", "Shoulders"],
    thumbnail: img.thumb("ex-downward-dog.webp"),
    images: { stepByStep: [img.step("Yoga", "downward-dog-1.webp"), img.step("Yoga", "downward-dog-2.webp")] },
    steps: ["Hands and knees.", "Lift hips up/back.", "Press heels down gently.", "Breathe."],
    formTips: ["Long spine", "Bend knees if tight"],
    tags: ["yoga", "stretch", "fullbody"],
  },
  {
    id: "warrior-1",
    name: "Warrior I",
    category: "Yoga",
    difficulty: "Intermediate",
    equipment: ["Mat"],
    duration: "45 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "15 sec",
    description: "Standing yoga pose for strength and balance.",
    benefits: ["Leg strength", "Hip opening", "Stability"],
    primaryMuscles: ["Quads", "Glutes", "Shoulders"],
    thumbnail: img.thumb("ex-warrior.webp"),
    images: { stepByStep: [img.step("Yoga", "warrior-1-1.webp"), img.step("Yoga", "warrior-1-2.webp")] },
    steps: ["Step one foot forward.", "Back heel grounded.", "Front knee bent.", "Arms up."],
    formTips: ["Hips square", "Reach tall"],
    tags: ["yoga", "balance", "strength"],
  },

  // ===== STRETCHING =====
  {
    id: "hamstring-stretch",
    name: "Hamstring Stretch",
    category: "Stretching",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "45 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Improves hamstring flexibility and reduces posterior tightness.",
    benefits: ["Flexibility", "Lower back relief"],
    primaryMuscles: ["Hamstrings"],
    thumbnail: img.thumb("ex-hamstring-stretch.webp"),
    images: { stepByStep: [img.step("Stretching", "hamstring-stretch-1.webp"), img.step("Stretching", "hamstring-stretch-2.webp")] },
    steps: ["Sit with one leg extended.", "Hinge at hips.", "Hold and switch."],
    formTips: ["Back straight", "Hinge from hips"],
    tags: ["stretch", "hamstrings", "mobility"],
  },
  {
    id: "quad-stretch",
    name: "Quad Stretch",
    category: "Stretching",
    difficulty: "Beginner",
    equipment: ["Wall", "Chair"],
    duration: "45 sec each side",
    sets: 2,
    reps: "Hold",
    restBetween: "15 sec",
    description: "Opens front of thigh after leg workouts.",
    benefits: ["Quad flexibility", "Hip comfort"],
    primaryMuscles: ["Quadriceps"],
    thumbnail: img.thumb("ex-quad-stretch.webp"),
    images: { stepByStep: [img.step("Stretching", "quad-stretch-1.webp"), img.step("Stretching", "quad-stretch-2.webp")] },
    steps: ["Stand and hold support.", "Grab ankle behind.", "Knees together.", "Hold and switch."],
    formTips: ["Tuck pelvis slightly", "Don’t flare knee"],
    tags: ["stretch", "quads", "thighs"],
  },
  {
    id: "butterfly-stretch",
    name: "Butterfly Stretch",
    category: "Stretching",
    difficulty: "Beginner",
    equipment: ["Mat"],
    duration: "1 min",
    sets: 2,
    reps: "Hold",
    restBetween: "20 sec",
    description: "Hip opener stretching inner thighs.",
    benefits: ["Hip mobility", "Inner thigh stretch"],
    primaryMuscles: ["Adductors", "Hip flexors"],
    thumbnail: img.thumb("ex-butterfly.webp"),
    images: { stepByStep: [img.step("Stretching", "butterfly-1.webp"), img.step("Stretching", "butterfly-2.webp")] },
    steps: ["Sit, soles together.", "Sit tall.", "Hold and breathe."],
    formTips: ["No bouncing", "Gentle forward fold optional"],
    tags: ["stretch", "hips", "adductors"],
  },
];

// ===================== AUTO CATEGORY COUNTS =====================

const CATEGORIES: CategoryCard[] = CATEGORIES_BASE.map((c) => ({
  ...c,
}));

// ===================== UI HELPERS =====================

function getDifficultyColor(level: Difficulty): string {
  switch (level) {
    case "Beginner":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "Intermediate":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "Advanced":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
  }
}

function countByCategory(category: ExerciseCategory) {
  return EXERCISES.filter((e) => e.category === category).length;
}

function prettyEquipmentLabel(eq: Equipment) {
  return eq;
}

// ===================== MAIN COMPONENT =====================

export function ExerciseLibraryTab() {
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "All">("All");
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | "All">("All");

  const equipmentTypes = useMemo(() => {
    const types = new Set<Equipment>();
    EXERCISES.forEach((ex) => ex.equipment.forEach((eq) => types.add(eq)));
    return ["All", ...Array.from(types)] as const;
  }, []);

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return EXERCISES.filter((ex) => {
      if (activeCategory !== "All" && ex.category !== activeCategory) return false;
      if (difficultyFilter !== "All" && ex.difficulty !== difficultyFilter) return false;
      if (equipmentFilter !== "All" && !ex.equipment.includes(equipmentFilter)) return false;

      if (query) {
        const searchable = [
          ex.name,
          ex.category,
          ex.description,
          ...ex.primaryMuscles,
          ...(ex.secondaryMuscles ?? []),
          ...ex.benefits,
          ...ex.tags,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      }

      return true;
    });
  }, [activeCategory, searchQuery, difficultyFilter, equipmentFilter]);

  const resetAll = () => {
    setActiveCategory("All");
    setSearchQuery("");
    setDifficultyFilter("All");
    setEquipmentFilter("All");
  };

  return (
    <div className="ex-wrap">
      {/* Header */}
      <div className="ex-header">
        <div className="ex-header-content">
          <div className="ex-badge">
            <span className="ex-badge-ico">
              <Icon name="category" />
            </span>
            Exercise Library
          </div>

          <h1 className="ex-title">Complete Exercise Guide</h1>

          <p className="ex-subtitle">
            {EXERCISES.length}+ exercises with steps, form tips, and reference visuals
          </p>
        </div>

        {/* Search */}
        <div className="ex-search-container">
          <div className="ex-search">
            <span className="ex-search-icon">
              <Icon name="search" />
            </span>

            <input
              type="text"
              className="ex-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exercise, muscle, benefit, tag..."
            />

            {searchQuery && (
              <button className="ex-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
                <Icon name="x" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="ex-filters">
          <select
            className="options"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as typeof difficultyFilter)}
          >
            <option value="All">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <select
            className="options"
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value as typeof equipmentFilter)}
          >
            {equipmentTypes.map((eq) => (
              <option key={eq} value={eq}>
                {eq === "All" ? "All Equipment" : prettyEquipmentLabel(eq)}
              </option>
            ))}
          </select>

          <button className="ex-filter-reset" onClick={resetAll}>
            <span className="ex-btn-ico">
              <Icon name="reset" />
            </span>
            Reset Filters
          </button>
        </div>
      </div>

      {/* Category Grid */}
      <div className="ex-categories">
        <button
          className={`ex-category-card ${activeCategory === "All" ? "active" : ""}`}
          onClick={() => setActiveCategory("All")}
        >
          <div className="ex-category-media">
            <div className="ex-category-icon">
              <Icon name="grid" />
            </div>
          </div>
          <div className="ex-category-title">All Exercises</div>
          <div className="ex-category-count">{EXERCISES.length} exercises</div>
        </button>

        {CATEGORIES.map((cat) => {
          const count = countByCategory(cat.category);
          return (
            <button
              key={cat.category}
              className={`ex-category-card ${activeCategory === cat.category ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.category)}
            >
              <div className="ex-category-media">
                <div className="ex-category-image">
                  <img
                    src={safeImg(cat.image)}
                    alt={cat.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = img.fallback();
                    }}
                  />
                  <div className="ex-category-overlay" />
                </div>

                <div className="ex-category-icon">
                  <Icon name={cat.iconKey} />
                </div>
              </div>

              <div className="ex-category-title">{cat.title}</div>
              <div className="ex-category-desc">{cat.description}</div>
              <div className="ex-category-count">{count} exercises</div>

              <div className="ex-category-benefits">
                {cat.benefits.map((b) => (
                  <span key={b} className="ex-category-benefit">
                    {b}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Exercise Grid */}
      <div className="ex-grid">
        {filteredExercises.map((exercise) => (
          <div
            key={exercise.id}
            className={`ex-card ${selectedExercise?.id === exercise.id ? "selected" : ""}`}
            onClick={() => setSelectedExercise(exercise)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelectedExercise(exercise);
            }}
          >
            <div className="ex-card-image">
              <img
                src={safeImg(exercise.thumbnail || exercise.images.stepByStep[0])}
                alt={exercise.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = img.fallback();
                }}
              />

              <div className="ex-card-category">{exercise.category}</div>

              <div className={`ex-card-difficulty ${getDifficultyColor(exercise.difficulty)}`}>
                {exercise.difficulty}
              </div>
            </div>

            <div className="ex-card-content">
              <h3 className="ex-card-title">{exercise.name}</h3>

              <div className="ex-card-meta">
                <span className="ex-meta-item">
                  <span className="ex-meta-ico">
                    <Icon name="clock" />
                  </span>
                  {exercise.duration}
                </span>

                <span className="ex-meta-item">
                  <span className="ex-meta-ico">
                    <Icon name="repeat" />
                  </span>
                  {exercise.sets} sets × {exercise.reps}
                </span>

                <span className="ex-meta-item">
                  <span className="ex-meta-ico">
                    <Icon name="rest" />
                  </span>
                  {exercise.restBetween}
                </span>
              </div>

              <div className="ex-card-equipment">
                {exercise.equipment.map((eq) => (
                  <span key={eq} className="ex-equipment-tag">
                    {eq}
                  </span>
                ))}
              </div>

              <p className="ex-card-description">{exercise.description}</p>

              <div className="ex-card-muscles">
                {exercise.primaryMuscles.slice(0, 3).map((muscle) => (
                  <span key={muscle} className="ex-muscle-tag">
                    {muscle}
                  </span>
                ))}
                {exercise.primaryMuscles.length > 3 && (
                  <span className="ex-muscle-tag">+{exercise.primaryMuscles.length - 3}</span>
                )}
              </div>

              <div className="ex-card-stats">
                <div className="ex-stat">
                  <span className="ex-stat-label">Sets</span>
                  <span className="ex-stat-value">{exercise.sets}</span>
                </div>
                <div className="ex-stat">
                  <span className="ex-stat-label">Reps</span>
                  <span className="ex-stat-value">{exercise.reps}</span>
                </div>
                <div className="ex-stat">
                  <span className="ex-stat-label">Rest</span>
                  <span className="ex-stat-value">{exercise.restBetween}</span>
                </div>
              </div>

              <button className="ex-view-btn" type="button">
                View Details
              </button>
            </div>
          </div>
        ))}

        {filteredExercises.length === 0 && (
          <div className="ex-empty">
            <div className="ex-empty-icon">
              <Icon name="search" />
            </div>
            <h3>No exercises found</h3>
            <p>Try adjusting filters or changing your search.</p>
            <button className="ex-empty-reset" onClick={resetAll}>
              <span className="ex-btn-ico">
                <Icon name="reset" />
              </span>
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedExercise && (
        <div className="ex-modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="ex-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="ex-modal-close"
              onClick={() => setSelectedExercise(null)}
              aria-label="Close details"
            >
              <Icon name="close" />
            </button>

            <div className="ex-modal-grid">
              {/* Left */}
              <div className="ex-modal-images">
                <div className="ex-modal-main-image">
                  <img
                    src={safeImg(selectedExercise.thumbnail || selectedExercise.images.stepByStep[0])}
                    alt={selectedExercise.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = img.fallback();
                    }}
                  />
                </div>

                {selectedExercise.images.stepByStep.length > 1 && (
                  <div className="ex-modal-thumbnails">
                    {selectedExercise.images.stepByStep.map((src, idx) => (
                      <div key={src} className="ex-thumbnail">
                        <img
                          src={safeImg(src)}
                          alt={`Step ${idx + 1}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = img.fallback();
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="ex-modal-details">
                <div className="ex-modal-header">
                  <div>
                    <h2>{selectedExercise.name}</h2>
                    <div className="ex-modal-meta">
                      <span className={`ex-difficulty-badge ${getDifficultyColor(selectedExercise.difficulty)}`}>
                        {selectedExercise.difficulty}
                      </span>
                      <span className="ex-category-badge">{selectedExercise.category}</span>
                    </div>
                  </div>
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="list" />
                    </span>
                    Description
                  </h4>
                  <p>{selectedExercise.description}</p>
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="target" />
                    </span>
                    Benefits
                  </h4>
                  <ul className="ex-benefits-list">
                    {selectedExercise.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="target" />
                    </span>
                    Target Muscles
                  </h4>

                  <div className="ex-muscle-group">
                    <strong>Primary</strong>
                    <div className="ex-muscle-tags">
                      {selectedExercise.primaryMuscles.map((m) => (
                        <span key={m} className="ex-muscle-tag primary">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedExercise.secondaryMuscles && selectedExercise.secondaryMuscles.length > 0 && (
                    <div className="ex-muscle-group">
                      <strong>Secondary</strong>
                      <div className="ex-muscle-tags">
                        {selectedExercise.secondaryMuscles.map((m) => (
                          <span key={m} className="ex-muscle-tag secondary">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="clock" />
                    </span>
                    Workout Info
                  </h4>

                  <div className="ex-info-grid">
                    <div className="ex-info-item">
                      <span className="ex-info-label">Sets</span>
                      <span className="ex-info-value">{selectedExercise.sets}</span>
                    </div>
                    <div className="ex-info-item">
                      <span className="ex-info-label">Reps</span>
                      <span className="ex-info-value">{selectedExercise.reps}</span>
                    </div>
                    <div className="ex-info-item">
                      <span className="ex-info-label">Rest</span>
                      <span className="ex-info-value">{selectedExercise.restBetween}</span>
                    </div>
                    <div className="ex-info-item">
                      <span className="ex-info-label">Duration</span>
                      <span className="ex-info-value">{selectedExercise.duration}</span>
                    </div>
                  </div>
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="list" />
                    </span>
                    Step-by-Step
                  </h4>
                  <ol className="ex-steps-list">
                    {selectedExercise.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>

                <div className="ex-modal-section">
                  <h4>
                    <span className="ex-h-ico">
                      <Icon name="list" />
                    </span>
                    Form Tips
                  </h4>
                  <ul className="ex-tips-list">
                    {selectedExercise.formTips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>

                {selectedExercise.commonMistakes && selectedExercise.commonMistakes.length > 0 && (
                  <div className="ex-modal-section">
                    <h4>
                      <span className="ex-h-ico">
                        <Icon name="shield" />
                      </span>
                      Common Mistakes
                    </h4>
                    <ul className="ex-mistakes-list">
                      {selectedExercise.commonMistakes.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedExercise.contraindications && selectedExercise.contraindications.length > 0 && (
                  <div className="ex-modal-section">
                    <h4>
                      <span className="ex-h-ico">
                        <Icon name="shield" />
                      </span>
                      Avoid If
                    </h4>
                    <ul className="ex-contraindications-list">
                      {selectedExercise.contraindications.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedExercise.modifications && (
                  <div className="ex-modal-section">
                    <h4>
                      <span className="ex-h-ico">
                        <Icon name="swap" />
                      </span>
                      Modifications
                    </h4>
                    {selectedExercise.modifications.easier && (
                      <div className="ex-modification">
                        <span className="ex-mod-label">Easier:</span> {selectedExercise.modifications.easier}
                      </div>
                    )}
                    {selectedExercise.modifications.harder && (
                      <div className="ex-modification">
                        <span className="ex-mod-label">Harder:</span> {selectedExercise.modifications.harder}
                      </div>
                    )}
                  </div>
                )}

                <div className="ex-modal-actions">
                  {selectedExercise.videoUrl ? (
                    <a
                      href={selectedExercise.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ex-video-btn"
                    >
                      <span className="ex-btn-ico">
                        <Icon name="play" />
                      </span>
                      Watch Video Tutorial
                    </a>
                  ) : (
                    <button className="ex-video-btn disabled" type="button" disabled>
                      <span className="ex-btn-ico">
                        <Icon name="play" />
                      </span>
                      Video Coming Soon
                    </button>
                  )}

                  <button className="ex-close-btn" onClick={() => setSelectedExercise(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}