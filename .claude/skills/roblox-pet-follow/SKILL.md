---
name: roblox-pet-follow
description: Use when making pets follow players in Roblox: models in ReplicatedStorage, rigging with Motor6D, AlignPosition/AlignOrientation, network ownership, multiple pets.
---

# Pets that follow
- Template models in `ReplicatedStorage.ForgePets`; clone on spawn, unanchor, `CanCollide/CanQuery/CanTouch = false`, `Massless = true` except an invisible root.
- Root part + `AlignPosition` (OneAttachment, MaxForce ~1e6, Responsiveness 15–25) + `AlignOrientation`, target = player root CFrame × offset (e.g. `CFrame.new(3, 1.5, 3)`); multiple pets: offsets on a circle behind the player.
- `root:SetNetworkOwner(player)` for smooth movement, or animate purely on clients.
- Rig: Motor6D from parent to child with `C0 = part0.CFrame:Inverse() * part1.CFrame`, `C1 = identity`; animate by setting `Motor6D.Transform` on clients (no replication cost).
- Clean up on CharacterRemoving / PlayerRemoving.
