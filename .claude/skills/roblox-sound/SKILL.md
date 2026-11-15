---
name: roblox-sound
description: Use when adding audio to Roblox games: Sound objects, SoundGroups, built-in sounds, uploading audio, never inventing asset ids.
---

# Sound
- `Sound` under the part (3D) or SoundService/PlayerGui (2D); `SoundGroup` for volume categories with ducking via `CompressorSoundEffect`/`EqualizerSoundEffect`.
- Never invent `rbxassetid://` numbers. Use the Creator Store (free audio, licensed) or upload your own (create.roblox.com, audio upload quota is free with limits).
- Local engine files like `rbxasset://sounds/...` ship with the client but the list can change — make ids configurable.
- One-shots: create, `Play()`, destroy on `Ended`; pitch variation (PlaybackSpeed 0.9–1.1) avoids repetition.
- Sync with visuals: start the sound at the same frame as the flash/reveal.
