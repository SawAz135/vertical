# Studio, official validation and avatar APIs

## Import and inspect

Use the matching [Importer](https://create.roblox.com/docs/studio/importer) avatar/rig settings, then [AFT](https://create.roblox.com/docs/avatar/accessory-fitting-tool) for accessories or [Avatar Setup](https://create.roblox.com/docs/avatar-setup) where appropriate. Inspect the resulting Explorer hierarchy, actual attachments, scale and wrapping data; do not infer the result from the FBX alone.

Marketplace accessories become Accessory instances with a Handle and appropriate Attachment. Layered items additionally use WrapLayer; character body parts use WrapTarget data. Makeup uses its texture-transfer/Decal workflow. Bodies and heads require the category's complete imported rig/cage/facial structure.

When a Studio MCP is available, first enumerate connected Studio instances and choose the intended test project. Use a scratch asset/test place for probes; preserve the user's production scene. Inspect tools and supported execution context before calling them. The skill supplies no MCP endpoint, port or credential and does not assume a specific third-party server is installed.

## Validation harness

`scripts/studio_validate.luau` returns a function. A local Studio ModuleScript containing it can be invoked as follows; callers provide the actual imported instance, not an invented global path:

```lua
local validate = require(pathToValidationModule)
local result = validate({
    root = importedAccessory,
    kind = "rigid",
    player = game:GetService("Players"):GetPlayers()[1],
    accessoryType = Enum.AccessoryType.Hat,
})
print(game:GetService("HttpService"):JSONEncode(result))
```

In edit mode it performs structural preflight and reports official validation as unavailable. In a Studio play session it calls supported [AvatarCreationService](https://create.roblox.com/docs/reference/engine/classes/AvatarCreationService) methods:

- `ValidateUGCAccessoryAsync(player, accessory, accessoryType)` for a supported accessory.
- `ValidateUGCBodyPartAsync(player, instance, bodyPart)` using the documented body-part folder structure. Head has its own input details.
- `ValidateUGCFullBodyAsync(player, humanoidDescription)` using BodyPartDescription children containing instances for all required parts; optionally AccessoryDescription children.

Incorrect input shape, unavailable API or absent Player is `NOT_CHECKED`, preserving the original error. A returned technical failure is `FAIL`. The harness reads the supplied asset, does not publish and does not establish visual fitting or moderation.

For animation packs, makeup and other categories not supported by these calls, use their actual Studio validation/publishing UI. Do not pretend this small harness reproduces the entire [UGC validation system](https://create.roblox.com/docs/marketplace/validation-system).

## Avatar commerce and customization

Read [Avatar Editor Service](https://create.roblox.com/docs/players/avatar-editor) for inventory permission, catalog search, try-on and outfit saving. Request the user's inventory permission through the real prompt and inspect the response before inventory reads. Use catalog and item/bundle identifiers according to the exact API type, with pagination where required.

Read [avatar item sales](https://create.roblox.com/docs/production/monetization/avatar-items) for in-experience sale location configuration. The creator configures allowed places; the experience implements allowed sale behavior. Use current MarketplaceService purchase/bulk-purchase events and item/bundle distinctions. A prompt returning does not automatically prove ownership or commission payment; use authoritative results and server-side verification appropriate to the API.

AvatarCreationService and in-experience avatar creation have their own capabilities, tokens and requirements; they are not an unrestricted automation route for every creator's Marketplace upload.

## Engine versus Open Cloud

Engine APIs run as Luau inside Roblox. Open Cloud uses external HTTP authentication, scopes and supported asset types. The [Assets API](https://create.roblox.com/docs/cloud/guides/usage-assets) supports specific generic asset operations; uploading a Model is not equivalent to publishing UGC to the Marketplace. Verify that a specific operation supports the intended category before implementing it. Keep external credentials outside exported avatar files and source control.
