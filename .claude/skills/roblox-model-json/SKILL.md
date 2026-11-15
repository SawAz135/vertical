---
name: roblox-model-json
description: Use when writing Rojo .model.json by hand or generating it from code (parts, GUI, attributes, enums, Color3, UDim2, CFrame).
---

# Rojo model.json formats
```json
{ "className": "Part", "properties": {
    "Size": [2, 1, 4], "Color": [0.5, 0.2, 1], "Anchored": true,
    "CFrame": { "position": [0,5,0], "orientation": [[1,0,0],[0,1,0],[0,0,1]] },
    "Material": "Neon", "Shape": "Ball" },
  "attributes": { "ForgeTint": true, "Speed": 4.5, "Label": "x" },
  "children": [ { "className": "UICorner", "properties": { "CornerRadius": [0, 12] } } ] }
```
- Color3 = floats 0–1 (implicit) — not 0–255. UDim2 = `[[xs, xo], [ys, yo]]`; UDim = `[scale, offset]`; Vector2 `[x,y]`.
- Enums as their item name string ("Neon", "Center"). NumberSequence/ColorSequence use explicit form: `{ "ColorSequence": { "keypoints": [{ "time": 0, "color": [1,0,0] }, ...] } }`.
- Script source: property `Source` (string). Attributes support bool, number, string, Vector3, Color3, UDim2.
- Names need not be unique, but FindFirstChild returns the first — make exported names unique (`Name2`, `Name3`).
