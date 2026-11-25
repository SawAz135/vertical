--[[ MonetizationConfig: everything bought with Robux.
     The ids were created on the game (universe 3982038893) through Open Cloud, each with
     its studded 3D icon. An id of 0 = not set up yet: the button shows
     "SOON" and nothing can be bought, so the game never prompts a wrong item. ]]
local M = {}

-- one-time GAMEPASSES (owned forever)
M.Passes = {
	Luck2x = { id = 2101679131, price = 299, name = "x2 Luck", desc = "Double luck on every animal pull and every fish. Forever." },
	Money2x = { id = 2099729878, price = 399, name = "x2 Money", desc = "Your base makes twice the money. Forever." },
}
M.PassOrder = { "Luck2x", "Money2x" }

-- DEVELOPER PRODUCTS (can be bought again and again): luck potions
M.Products = {
	Luck2_1 = { id = 3736247228, price = 49, potion = "Luck2", count = 1 },
	Luck5_1 = { id = 3736247283, price = 99, potion = "Luck5", count = 1 },
	Luck10_1 = { id = 3736247296, price = 199, potion = "Luck10", count = 1 },
	Luck2_3 = { id = 3736247307, price = 119, potion = "Luck2", count = 3 },
	Luck5_3 = { id = 3736247320, price = 249, potion = "Luck5", count = 3 },
	Luck10_3 = { id = 3736247333, price = 499, potion = "Luck10", count = 3 },
}

-- the products of one potion type: { single, pack of 3 }
function M.forPotion(potion: string): (string?, string?)
	local one, three
	for key, p in M.Products do
		if p.potion == potion then
			if p.count == 1 then one = key else three = key end
		end
	end
	return one, three
end

function M.productById(id: number): (string?, any)
	if id == 0 then return nil, nil end
	for key, p in M.Products do
		if p.id == id then return key, p end
	end
	return nil, nil
end

function M.passById(id: number): string?
	if id == 0 then return nil end
	for key, p in M.Passes do
		if p.id == id then return key end
	end
	return nil
end

return M
