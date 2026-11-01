# CutooVerse icons: the home bar

The four square buttons at the bottom of the home screen: Chop, Puzzle, Free cut, Customize.

Put each finished PNG in this folder (`cutgame/icons/`) under its file name. The game picks it up by
itself on the next reload, in place of the drawn icon and its coloured square. A missing file is
fine: the drawn icon stays.

| File | Button | Also shows on |
|---|---|---|
| `mode-chop.png` | Chop | |
| `mode-puzzle.png` | Puzzle | |
| `mode-free.png` | Free cut | |
| `customize.png` | Customize | the Customize button at the top of the game screen |

Each prompt below is complete: copy one whole block per icon. The four share every setting except
the three fields at the top, so they come out as one family.

Where they show: alone on a dark frosted-glass square (about #12272a) in a bar at the bottom of the
screen, about 46 px wide, over teal, purple, dark or light backgrounds. The PNG replaces the
coloured rounded square the drawn icon sits on, so each icon carries its own colour.

---

## 1. Chop: `mode-chop.png`

```json
{
  "icon_name": "Chop",
  "icon_description": "A chunky chef's knife coming straight down onto a round orange that already shows three neat, evenly spaced slice gaps, a few tiny juice drops flying off.",
  "color_hint": "red #FF4136 knife handle as the dominant color, juicy orange #FF8A1A fruit, satin silver blade",

  "task": "Generate a single 3D icon of the object described by icon_name and icon_description, for a playful but premium mobile slicing game called CutooVerse.",

  "output": {
    "format": "PNG",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "resolution": "1024x1024",
    "object_count": 1,
    "display_context": "Shown alone on a dark frosted-glass square button (#12272a) in a bottom navigation bar, about 46 px wide, over teal, purple, dark or light game backgrounds."
  },

  "style": {
    "visual_language": "soft 3D icon, glossy candy plastic mixed with frosted glass, juicy and tactile, calm rather than toy-like",
    "shape_language": ["chunky, friendly forms", "thick rounded elements", "large corner radii", "soft beveled edges", "simple, instantly recognizable silhouette", "consistent visual depth across the set"],
    "materials": ["glossy candy plastic with a soft inner highlight", "frosted translucent glass for secondary parts", "knife blades in soft satin silver plastic, not real chrome"],
    "lighting": {
      "type": "soft studio lighting",
      "direction": "upper left",
      "highlights": "broad, subtle specular highlight plus a thin bright rim light along the top edges so the shape separates from a dark background",
      "shadows": "soft self-shadowing and gentle ambient occlusion only, no cast shadow on a floor",
      "contrast": "medium"
    }
  },

  "color_system": {
    "instruction": "Use color_hint. The icon must read clearly on a dark glass square and belong to one family with the other three bar icons.",
    "palette": {
      "brand_accent": "CutooVerse red #FF4136",
      "supporting": ["warm off-white #F2F1EE", "juicy orange #FF8A1A", "amber #F2A020", "mint #4FD1A5", "sky blue #8EC5F0", "lavender purple #A35BE0"],
      "dominant_colors": 1, "secondary_colors": 1, "optional_accent_colors": 1,
      "saturation": "medium-rich, never neon", "brightness": "bright"
    },
    "selection_rules": ["One dominant color, one supporting color, at most one small accent.", "Never a dark teal, black or dark gray main surface: it disappears on the dark button.", "Highlights lighter and shadows slightly cooler than the local surface color."]
  },

  "composition": {
    "camera": "slightly elevated three-quarter front view, same angle for every icon",
    "placement": "centered", "scale": "object fills about 78 percent of the canvas",
    "padding": "even on all sides", "perspective": "subtle, near-orthographic",
    "silhouette": "clear and readable at 40 px"
  },

  "detail_policy": {"complexity": "minimal", "instruction": "Fewest necessary parts; rounded geometry instead of thin lines.", "small_details": "enlarged and simplified", "text_substitute": "never letters or numbers; use simple shapes instead"},

  "constraints": ["Create only the object described.", "Keep the whole object inside the canvas.", "Truly transparent background, clean alpha, no halo or white fringe.", "No floor, platform, cast shadow, frame, badge, circle or background shape.", "No text, letters, numbers, logos or watermarks.", "No real brand logos, no faces, characters or mascots.", "One object per image, no variations.", "No photorealistic materials, no sharp corners or thin fragile parts."],

  "quality_goal": "A polished, juicy 3D icon that sits naturally on a dark glass button, one family with the other CutooVerse bar icons."
}
```

## 2. Puzzle: `mode-puzzle.png`

```json
{
  "icon_name": "Puzzle",
  "icon_description": "A round fruit cut into four even wedges, slightly pulled apart from the centre, with a small round target dot floating in the middle gap: the goal of cutting exactly the right number of pieces.",
  "color_hint": "mint #4FD1A5 target dot and rind as the dominant color, juicy orange #FF8A1A wedge flesh, small warm off-white pith",

  "task": "Generate a single 3D icon of the object described by icon_name and icon_description, for a playful but premium mobile slicing game called CutooVerse.",

  "output": {
    "format": "PNG",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "resolution": "1024x1024",
    "object_count": 1,
    "display_context": "Shown alone on a dark frosted-glass square button (#12272a) in a bottom navigation bar, about 46 px wide, over teal, purple, dark or light game backgrounds."
  },

  "style": {
    "visual_language": "soft 3D icon, glossy candy plastic mixed with frosted glass, juicy and tactile, calm rather than toy-like",
    "shape_language": ["chunky, friendly forms", "thick rounded elements", "large corner radii", "soft beveled edges", "simple, instantly recognizable silhouette", "consistent visual depth across the set"],
    "materials": ["glossy candy plastic with a soft inner highlight", "frosted translucent glass for secondary parts", "knife blades in soft satin silver plastic, not real chrome"],
    "lighting": {
      "type": "soft studio lighting",
      "direction": "upper left",
      "highlights": "broad, subtle specular highlight plus a thin bright rim light along the top edges so the shape separates from a dark background",
      "shadows": "soft self-shadowing and gentle ambient occlusion only, no cast shadow on a floor",
      "contrast": "medium"
    }
  },

  "color_system": {
    "instruction": "Use color_hint. The icon must read clearly on a dark glass square and belong to one family with the other three bar icons.",
    "palette": {
      "brand_accent": "CutooVerse red #FF4136",
      "supporting": ["warm off-white #F2F1EE", "juicy orange #FF8A1A", "amber #F2A020", "mint #4FD1A5", "sky blue #8EC5F0", "lavender purple #A35BE0"],
      "dominant_colors": 1, "secondary_colors": 1, "optional_accent_colors": 1,
      "saturation": "medium-rich, never neon", "brightness": "bright"
    },
    "selection_rules": ["One dominant color, one supporting color, at most one small accent.", "Never a dark teal, black or dark gray main surface: it disappears on the dark button.", "Highlights lighter and shadows slightly cooler than the local surface color."]
  },

  "composition": {
    "camera": "slightly elevated three-quarter front view, same angle for every icon",
    "placement": "centered", "scale": "object fills about 78 percent of the canvas",
    "padding": "even on all sides", "perspective": "subtle, near-orthographic",
    "silhouette": "clear and readable at 40 px"
  },

  "detail_policy": {"complexity": "minimal", "instruction": "Fewest necessary parts; rounded geometry instead of thin lines.", "small_details": "enlarged and simplified", "text_substitute": "never letters or numbers; use simple shapes instead"},

  "constraints": ["Create only the object described.", "Keep the whole object inside the canvas.", "Truly transparent background, clean alpha, no halo or white fringe.", "No floor, platform, cast shadow, frame, badge, circle or background shape.", "No text, letters, numbers, logos or watermarks.", "No real brand logos, no faces, characters or mascots.", "One object per image, no variations.", "No photorealistic materials, no sharp corners or thin fragile parts."],

  "quality_goal": "A polished, juicy 3D icon that sits naturally on a dark glass button, one family with the other CutooVerse bar icons."
}
```

## 3. Free cut: `mode-free.png`

```json
{
  "icon_name": "Free cut",
  "icon_description": "A chunky knife blade at a diagonal, sweeping upward, leaving one thick curved swoosh trail behind it that fades out, like a finger swipe across the screen.",
  "color_hint": "sky blue #8EC5F0 swoosh trail as the dominant color, satin silver blade, small red #FF4136 handle",

  "task": "Generate a single 3D icon of the object described by icon_name and icon_description, for a playful but premium mobile slicing game called CutooVerse.",

  "output": {
    "format": "PNG",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "resolution": "1024x1024",
    "object_count": 1,
    "display_context": "Shown alone on a dark frosted-glass square button (#12272a) in a bottom navigation bar, about 46 px wide, over teal, purple, dark or light game backgrounds."
  },

  "style": {
    "visual_language": "soft 3D icon, glossy candy plastic mixed with frosted glass, juicy and tactile, calm rather than toy-like",
    "shape_language": ["chunky, friendly forms", "thick rounded elements", "large corner radii", "soft beveled edges", "simple, instantly recognizable silhouette", "consistent visual depth across the set"],
    "materials": ["glossy candy plastic with a soft inner highlight", "frosted translucent glass for secondary parts", "knife blades in soft satin silver plastic, not real chrome"],
    "lighting": {
      "type": "soft studio lighting",
      "direction": "upper left",
      "highlights": "broad, subtle specular highlight plus a thin bright rim light along the top edges so the shape separates from a dark background",
      "shadows": "soft self-shadowing and gentle ambient occlusion only, no cast shadow on a floor",
      "contrast": "medium"
    }
  },

  "color_system": {
    "instruction": "Use color_hint. The icon must read clearly on a dark glass square and belong to one family with the other three bar icons.",
    "palette": {
      "brand_accent": "CutooVerse red #FF4136",
      "supporting": ["warm off-white #F2F1EE", "juicy orange #FF8A1A", "amber #F2A020", "mint #4FD1A5", "sky blue #8EC5F0", "lavender purple #A35BE0"],
      "dominant_colors": 1, "secondary_colors": 1, "optional_accent_colors": 1,
      "saturation": "medium-rich, never neon", "brightness": "bright"
    },
    "selection_rules": ["One dominant color, one supporting color, at most one small accent.", "Never a dark teal, black or dark gray main surface: it disappears on the dark button.", "Highlights lighter and shadows slightly cooler than the local surface color."]
  },

  "composition": {
    "camera": "slightly elevated three-quarter front view, same angle for every icon",
    "placement": "centered", "scale": "object fills about 78 percent of the canvas",
    "padding": "even on all sides", "perspective": "subtle, near-orthographic",
    "silhouette": "clear and readable at 40 px"
  },

  "detail_policy": {"complexity": "minimal", "instruction": "Fewest necessary parts; rounded geometry instead of thin lines.", "small_details": "enlarged and simplified", "text_substitute": "never letters or numbers; use simple shapes instead"},

  "constraints": ["Create only the object described.", "Keep the whole object inside the canvas.", "Truly transparent background, clean alpha, no halo or white fringe.", "No floor, platform, cast shadow, frame, badge, circle or background shape.", "No text, letters, numbers, logos or watermarks.", "No real brand logos, no faces, characters or mascots.", "One object per image, no variations.", "No photorealistic materials, no sharp corners or thin fragile parts."],

  "quality_goal": "A polished, juicy 3D icon that sits naturally on a dark glass button, one family with the other CutooVerse bar icons."
}
```

## 4. Customize: `customize.png`

```json
{
  "icon_name": "Customize",
  "icon_description": "A round painter's palette with four chunky glossy paint blobs and a small rounded brush resting across it: choosing the fruit, knife, board and backdrop.",
  "color_hint": "lavender purple #A35BE0 palette as the dominant color, paint blobs in red #FF4136, juicy orange #FF8A1A, mint #4FD1A5 and sky blue #8EC5F0, warm off-white brush tip",

  "task": "Generate a single 3D icon of the object described by icon_name and icon_description, for a playful but premium mobile slicing game called CutooVerse.",

  "output": {
    "format": "PNG",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "resolution": "1024x1024",
    "object_count": 1,
    "display_context": "Shown alone on a dark frosted-glass square button (#12272a) in a bottom navigation bar, about 46 px wide, and as a 30 px icon in a round glass button at the top of the game screen."
  },

  "style": {
    "visual_language": "soft 3D icon, glossy candy plastic mixed with frosted glass, juicy and tactile, calm rather than toy-like",
    "shape_language": ["chunky, friendly forms", "thick rounded elements", "large corner radii", "soft beveled edges", "simple, instantly recognizable silhouette", "consistent visual depth across the set"],
    "materials": ["glossy candy plastic with a soft inner highlight", "frosted translucent glass for secondary parts", "knife blades in soft satin silver plastic, not real chrome"],
    "lighting": {
      "type": "soft studio lighting",
      "direction": "upper left",
      "highlights": "broad, subtle specular highlight plus a thin bright rim light along the top edges so the shape separates from a dark background",
      "shadows": "soft self-shadowing and gentle ambient occlusion only, no cast shadow on a floor",
      "contrast": "medium"
    }
  },

  "color_system": {
    "instruction": "Use color_hint. The icon must read clearly on a dark glass square and belong to one family with the other three bar icons.",
    "palette": {
      "brand_accent": "CutooVerse red #FF4136",
      "supporting": ["warm off-white #F2F1EE", "juicy orange #FF8A1A", "amber #F2A020", "mint #4FD1A5", "sky blue #8EC5F0", "lavender purple #A35BE0"],
      "dominant_colors": 1, "secondary_colors": 1, "optional_accent_colors": 1,
      "saturation": "medium-rich, never neon", "brightness": "bright"
    },
    "selection_rules": ["One dominant color, one supporting color, at most one small accent (the paint blobs count as one accent group).", "Never a dark teal, black or dark gray main surface: it disappears on the dark button.", "Highlights lighter and shadows slightly cooler than the local surface color."]
  },

  "composition": {
    "camera": "slightly elevated three-quarter front view, same angle for every icon",
    "placement": "centered", "scale": "object fills about 78 percent of the canvas",
    "padding": "even on all sides", "perspective": "subtle, near-orthographic",
    "silhouette": "clear and readable at 30 px"
  },

  "detail_policy": {"complexity": "minimal", "instruction": "Fewest necessary parts; rounded geometry instead of thin lines.", "small_details": "enlarged and simplified", "text_substitute": "never letters or numbers; use simple shapes instead"},

  "constraints": ["Create only the object described.", "Keep the whole object inside the canvas.", "Truly transparent background, clean alpha, no halo or white fringe.", "No floor, platform, cast shadow, frame, badge, circle or background shape.", "No text, letters, numbers, logos or watermarks.", "No real brand logos, no faces, characters or mascots.", "One object per image, no variations.", "No photorealistic materials, no sharp corners or thin fragile parts."],

  "quality_goal": "A polished, juicy 3D icon that sits naturally on a dark glass button, one family with the other CutooVerse bar icons."
}
```

## Notes

- Keep the file names exactly as written (lower case, `.png`).
- Generate all four in one session if you can, so the lighting and angle match.
- If an icon looks small in its square, crop the PNG's empty margin a little before saving it here.
