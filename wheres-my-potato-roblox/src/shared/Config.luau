--[[ Config: every number of the game in one place (units = studs; 1 m ≈ 3.5 studs).
     Same economy, items and potato varieties as the web version of WHERE'S MY POTATO?. ]]
local Config = {}

-- ---------------------------------------------------------------- layout
Config.JAR = { Pos = Vector3.new(0, 0, 0), R = 24.5, Wall = 0.8, Base = 1.6, Rim = 105, Cap = 50000 }
Config.BIN = { Pos = Vector3.new(-11.2, 0, -50.75), W = 6, D = 6, H = 3, Floor = 0.45 }
Config.SPIRAL = { R = 29.6, Turns = 4, Y0 = 7, Y1 = 109, Width = 2.9, Theta0 = -math.pi / 2 }
Config.SHOP = { Pos = Vector3.new(-38.5, 0, -59.5) }
Config.SPAWN = CFrame.new(8.75, 6, -87.5) * CFrame.Angles(0, math.pi, 0)
-- flattened zones around structures { x, z, radius }
Config.CLEAR = {
	{ 0, 0, 37 }, -- jar + spiral foot
	{ -9, -51, 12 }, -- bin deck
	{ -38.5, -57, 16 }, -- shop
	{ -3, -36, 8 }, -- ramp
}
Config.WORLD = 1024 -- terrain half extent (studs)

-- ---------------------------------------------------------------- potatoes
Config.POTATO = { Spacing = 1.05, Len = 1.3, Radius = { PC = 34, Mobile = 24 }, PickRange = 16 }
Config.TOTAL_DESERT = 10_000_000_000

Config.VARIETIES = {
	{ id = "bintje", name = "Bintje", color = Color3.fromRGB(237, 184, 84), price = 1, weight = 72 },
	{ id = "charlotte", name = "Charlotte", color = Color3.fromRGB(250, 207, 115), price = 1.4, weight = 28 },
	{ id = "rosabelle", name = "Rosabelle", color = Color3.fromRGB(168, 82, 66), price = 2, weight = 0 },
	{ id = "russet", name = "Russet", color = Color3.fromRGB(173, 133, 87), price = 1.6, weight = 0 },
	{ id = "vitelotte", name = "Vitelotte violette", color = Color3.fromRGB(110, 52, 128), price = 25, weight = 0 },
	{ id = "doree", name = "Dorée de Bouchard", color = Color3.fromRGB(255, 196, 40), price = 60, weight = 0 },
}
-- digging: chance of a purple potato per layer (0 = surface: never)
Config.DIG_MAX = 9
Config.PURPLE = { 0, 0.01, 0.02, 0.035, 0.05, 0.07, 0.09, 0.12, 0.16 }

-- ---------------------------------------------------------------- shop (identical to the web game)
Config.ITEMS = {
	{ id = "bucket", icon = "🪣", name = "Contenant", levels = {
		{ name = "Mains nues", price = 0, cap = 0, desc = "Tu portes les patates dans tes bras." },
		{ name = "Seau en fer", price = 40, cap = 12, desc = "Un vieux seau cabossé. Ramasse 12 patates d’un coup." },
		{ name = "Grand seau galvanisé", price = 260, cap = 30, desc = "30 patates. Ça commence à peser." },
		{ name = "Bassine géante", price = 1100, cap = 70, desc = "Une bassine de lessive XXL. 70 patates." },
		{ name = "Benne à bras", price = 4200, cap = 160, desc = "Gérard l’a soudée lui-même. 160 patates." },
	} },
	{ id = "gloves", icon = "🧤", name = "Gants de récolte", levels = {
		{ name = "Sans gants", price = 0, cap = 3, desc = "3 patates dans les bras." },
		{ name = "Gants de jardin", price = 60, cap = 5, desc = "5 patates dans les bras." },
		{ name = "Gants de pro", price = 320, cap = 8, desc = "8 patates dans les bras, prises plus rapides." },
	} },
	{ id = "magnet", icon = "🧲", name = "Râteau aimanté", levels = {
		{ name = "Aucun", price = 0, radius = 3, rate = 9, desc = "Portée de ramassage normale." },
		{ name = "Râteau aimanté", price = 190, radius = 4.5, rate = 14, desc = "Attire les patates de plus loin." },
		{ name = "Aimant à tubercules", price = 800, radius = 6.5, rate = 20, desc = "Personne ne sait comment ça marche." },
		{ name = "Vortex à patates", price = 2900, radius = 9, rate = 30, desc = "Gérard décline toute responsabilité." },
	} },
	{ id = "vacuum", icon = "🌀", name = "Aspirateur à patates", levels = {
		{ name = "Aucun", price = 0, cap = 0, range = 0, rate = 0, desc = "Pas d’aspirateur." },
		{ name = "Aspirateur de jardin", price = 480, cap = 45, range = 17, rate = 16, desc = "Aspire les patates jusqu’à 5 m dans un réservoir de 45. Outil 3." },
		{ name = "Aspirateur industriel", price = 1900, cap = 110, range = 28, rate = 32, desc = "8 m de portée, 110 patates, deux fois plus vite." },
		{ name = "Trou noir portatif", price = 6800, cap = 260, range = 42, rate = 60, desc = "12 m, 260 patates. Ne pas pointer vers Gérard." },
	} },
	{ id = "cannon", icon = "💥", name = "Canon à patates", levels = {
		{ name = "Aucun", price = 0, power = 0, rate = 0, desc = "Pas de canon." },
		{ name = "Canon à patates", price = 750, power = 150, rate = 5, desc = "Tire tes patates jusqu’au bac depuis les dunes. Outil 4." },
		{ name = "Double canon", price = 2700, power = 190, rate = 9, desc = "Deux patates par tir, plus loin, plus vite." },
	} },
	{ id = "boots", icon = "🥾", name = "Bottes", levels = {
		{ name = "Chaussures de ville", price = 0, speed = 1, desc = "Vitesse normale." },
		{ name = "Bottes de champ", price = 130, speed = 1.2, desc = "+20 % de vitesse." },
		{ name = "Bottes de course", price = 650, speed = 1.42, desc = "+42 % de vitesse, saut plus haut." },
	} },
	{ id = "motor", icon = "⚙️", name = "Moteur du convoyeur", levels = {
		{ name = "Moteur d’origine", price = 0, feed = 0.3, travel = 1.0, desc = "≈ 3 patates / seconde, 1 s jusqu’au sommet." },
		{ name = "Moteur révisé", price = 110, feed = 0.2, travel = 0.8, desc = "≈ 5 patates / seconde, 0,8 s jusqu’au sommet." },
		{ name = "Moteur diesel", price = 380, feed = 0.13, travel = 0.7, desc = "≈ 8 patates / seconde, 0,7 s jusqu’au sommet." },
		{ name = "Turbo agricole", price = 1150, feed = 0.08, travel = 0.6, desc = "≈ 12 patates / seconde, 0,6 s jusqu’au sommet." },
		{ name = "Moteur de fusée", price = 3600, feed = 0.045, travel = 0.5, desc = "≈ 22 patates / seconde, 0,5 s jusqu’au sommet. Bruyant." },
	} },
	{ id = "fertilizer", icon = "🌱", name = "Engrais", levels = {
		{ name = "Aucun", price = 0, grow = 1, gold = 0, desc = "Les patates repoussent en 15-35 s." },
		{ name = "Compost maison", price = 270, grow = 0.6, gold = 0.008, desc = "Repousse plus vite, quelques patates dorées." },
		{ name = "Engrais miracle", price = 980, grow = 0.33, gold = 0.025, desc = "Repousse éclair, patates dorées fréquentes." },
	} },
	{ id = "contract", icon = "📜", name = "Contrat", levels = {
		{ name = "Vente au marché", price = 0, mult = 1, desc = "Prix normal." },
		{ name = "Contrat friterie", price = 1600, mult = 1.5, desc = "La friterie du village paie 50 % de plus." },
		{ name = "Contrat national", price = 6500, mult = 2.5, desc = "Tes patates partent dans tout le pays. ×2,5." },
	} },
}
Config.ITEM = {}
for _, it in Config.ITEMS do Config.ITEM[it.id] = it end

function Config.val(levels: { [string]: number }, id: string, key: string)
	local it = Config.ITEM[id]
	local lv = math.clamp(levels[id] or 0, 0, #it.levels - 1)
	return it.levels[lv + 1][key]
end

-- ---------------------------------------------------------------- Gérard
Config.LINES = {
	greet = { "Ah ! Le récolteur ! Entre, entre.", "Bonjour bonjour ! Tu viens dépenser tes sous ?", "Regarde-moi ce bocal… On n’a jamais vu ça dans le canton.", "Fais attention, la boutique est fragile. Comme moi." },
	buy = { "Excellent choix. Vraiment. Je dis pas ça à tout le monde.", "Tu ne le regretteras pas. Probablement.", "Ah, ça, c’est du matériel sérieux !", "Vendu ! Fais-en bon usage.", "Ma femme disait toujours : un bon outil, c’est la moitié du travail." },
	poor = { "Il te manque des sous, mon grand. Va ramasser !", "Hé non. Pas de crédit à la boutique.", "Reviens avec plus de patates dans le bocal." },
	max = { "Tu as déjà le meilleur, je ne peux rien faire de plus !" },
	overflow = { "IL DÉBORDE ! Le bocal déborde ! C’est magnifique !", "Les patates tombent partout ! Continue, continue !" },
	gold = { "Une patate DORÉE ?! Ça vaut une fortune, ça !" },
	purple = { "Une violette ! Elles dorment au fond du tas. Continue de creuser au même endroit." },
	dig = { "Dessus, il n’y a que des dorées. Mais si tu creuses toujours au même endroit, tu tomberas sur des violettes : rares, et 25 fois plus chères !" },
	idle = { "Il fait beau pour ramasser, hein ?", "Le convoyeur a 40 ans, sois gentil avec lui.", "Tu sais combien de patates il faut pour remplir ce bocal ? Moi non plus.", "N’oublie pas : le seau, c’est la vie." },
	welcome = { "Bienvenue ! Ramasse les patates du désert et verse-les dans le bac, au pied du bocal. Bonne récolte !" },
	star = { "Une patate filante ! Fais un vœu… et va la ramasser, elle est en or !" },
}

return Config
