---
name: roblox-localization-fr
description: Use when making Roblox games for French players or multiple languages: LocalizationTable, number formats, tone.
---

# French / localisation
- Write UI text in French first for a French audience; keep strings in one module so a LocalizationTable can be added later (`LocalizationService`, auto-translate for other languages).
- Numbers: abbreviations K/M/B work for kids everywhere; spaces as thousands separator in French (`1 000 067 $` reads better than 1,000,067).
- Tone: short, energetic, tu-form ("Ouvre 20 œufs !"). Avoid long sentences in buttons.
