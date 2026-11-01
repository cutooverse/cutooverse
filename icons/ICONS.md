# Cut Count icons

Put each finished PNG in this folder (`cutgame/icons/`) under the file name in the table. The game
picks it up by itself on the next reload and drops the drawn icon it uses now. A missing file is
fine: the drawn icon stays.

## The shared prompt

Use this block for every icon and fill in the three fields at the top from the table below.

```json
{
  "icon_name": "",
  "icon_description": "",
  "color_hint": "",

  "task": "Generate a single 3D icon of the object described by icon_name and icon_description, for a playful but premium mobile slicing game called Cut Count.",

  "output": {
    "format": "PNG",
    "aspect_ratio": "1:1",
    "background": "transparent",
    "resolution": "1024x1024",
    "object_count": 1,
    "display_context": "Shown on dark teal frosted-glass cards (#163f42 behind them) and on a warm off-white panel (#f6f2ea), at 22 to 64 px."
  },

  "style": {
    "visual_language": "soft 3D icon, glossy candy plastic mixed with frosted glass, juicy and tactile, calm rather than toy-like",
    "shape_language": [
      "chunky, friendly forms",
      "thick rounded elements",
      "large corner radii",
      "soft beveled edges",
      "simple, instantly recognizable silhouette",
      "consistent visual depth across the set"
    ],
    "materials": [
      "glossy candy plastic with a soft inner highlight",
      "frosted translucent glass for secondary parts",
      "knife blades in soft satin silver plastic, not real chrome"
    ],
    "lighting": {
      "type": "soft studio lighting",
      "direction": "upper left",
      "highlights": "broad, subtle specular highlight plus a thin bright rim light along the top edges so the shape separates from a dark teal background",
      "shadows": "soft self-shadowing and gentle ambient occlusion only, no cast shadow on a floor",
      "contrast": "medium"
    }
  },

  "color_system": {
    "instruction": "Use color_hint when provided. Every icon must belong to the same family and read clearly on dark teal and on warm off-white.",
    "palette": {
      "brand_accent": "Cut Count red #FF4136, the red of the 'N Cuts' titles. Dominant only on the main play icons.",
      "supporting": [
        "warm off-white #F2F1EE",
        "juicy orange #FF8A1A",
        "amber #F2A020",
        "mint #4FD1A5",
        "sky blue #8EC5F0",
        "walnut wood #A0683E"
      ],
      "dominant_colors": 1,
      "secondary_colors": 1,
      "optional_accent_colors": 1,
      "saturation": "medium-rich, never neon",
      "brightness": "bright"
    },
    "selection_rules": [
      "One dominant color, one supporting color, at most one small accent.",
      "Never a dark teal, black or dark gray main surface: it disappears on the cards.",
      "Highlights lighter and shadows slightly cooler than the local surface color."
    ]
  },

  "composition": {
    "camera": "slightly elevated three-quarter front view, same angle for every icon",
    "placement": "centered",
    "scale": "object fills about 72 percent of the canvas",
    "padding": "generous and balanced on all sides",
    "perspective": "subtle, near-orthographic",
    "silhouette": "clear and readable at 22 px"
  },

  "detail_policy": {
    "complexity": "minimal",
    "instruction": "Fewest necessary parts; rounded geometry instead of thin lines.",
    "small_details": "enlarged and simplified",
    "text_substitute": "never letters or numbers; use simple shapes instead"
  },

  "constraints": [
    "Create only the object described.",
    "Keep the whole object inside the canvas.",
    "Truly transparent background, clean alpha, no halo or white fringe.",
    "No floor, platform, cast shadow, frame, badge, circle or background shape.",
    "No text, letters, numbers, logos or watermarks.",
    "No real brand logos, no faces, characters or mascots.",
    "One object per image, no variations.",
    "No photorealistic materials, no sharp corners or thin fragile parts."
  ],

  "quality_goal": "A polished, juicy 3D icon that sits naturally on dark teal glass cards and on a warm off-white panel, one family with the other Cut Count icons."
}
```

## The icons

| File | icon_name | icon_description | color_hint | Where it shows |
|---|---|---|---|---|
| `mode-chop.png` | Chop | A chunky chef's knife coming down onto a round orange that already shows three neat slice gaps | red #FF4136 knife handle, orange fruit, silver blade | Home: Chop card |
| `mode-vs.png` | One versus many | An orange cut in two halves on the left and a small heap of tiny orange cubes on the right, side by side | orange with off-white pith, small red accent | Home: 1 VS N card |
| `mode-puzzle.png` | Exact pieces | A round fruit cut into four even wedges, slightly pulled apart, with a small round target dot in the middle | mint #4FD1A5 dominant, orange wedges | Home: Puzzle card |
| `mode-free.png` | Free swipe | A knife blade at an angle leaving one thick curved swoosh trail behind it | sky blue #8EC5F0 swoosh, silver blade | Home: Free cut card |
| `looks.png` | Looks | A round painter's palette with four chunky paint blobs | warm off-white palette, red, orange and mint blobs | Looks buttons |
| `settings.png` | Settings | A thick rounded cog wheel | warm off-white with a mint centre | Settings buttons |
| `star.png` | Star | A chunky five-point star with soft rounded tips | amber #F2A020 | Star count on the home screen |
| `add-photo.png` | Add photo | A rounded photo card showing a simple hill and sun, with a round plus badge on its corner | sky blue card, red plus badge | Looks › Fruit: Add photo |
| `style-free.png` | Free cuts | A sphere crossed by three thick cut lines at random angles | orange sphere, off-white lines | Cut style: Free |
| `style-dice.png` | Dice cuts | A neat stack of four small rounded cubes, like a diced fruit | orange cubes with off-white faces | Cut style: Dice |
| `style-burst.png` | Burst | A sphere breaking apart into chunky cubes flying outward | red and orange cubes | Cut style: Burst |
| `cam-top.png` | Top view | A small rounded camera tilted to look straight down, with a thick down arrow under it | warm off-white camera, sky blue arrow | Camera: Top |
| `cam-front.png` | Front view | A small rounded camera seen square on, with a thick horizontal arrow pointing forward | warm off-white camera, sky blue arrow | Camera: Front |
| `cam-close.png` | Close view | A small rounded camera with a plus-shaped zoom badge | warm off-white camera, mint badge | Camera: Close |

Notes

- Keep the file names exactly as written (lower case, `.png`).
- The mode icons sit in 46 px tiles and the others in 22 to 30 px, so a simple silhouette matters
  more than detail.
