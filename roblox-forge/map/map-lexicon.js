/* =====================================================================
   Roblox Forge - scene dictionary (French + English). Each line: words → a model
   family with settings. Plural forms are generated (s, x, aux, eaux, ies, es),
   accents are ignored, multi-word names (« bonhomme de neige ») are joined first.
   Unknown nouns still produce an object (plinth with the word), see map-scene.js.
   ===================================================================== */
const A = (species, extra = {}) => ({ kind: 'animal', species, ...extra });   // voxel animal
const C = (type, extra = {}) => ({ kind: 'thing', fam: 'critter', o: { type, ...extra } });
const V = (type, extra = {}) => ({ kind: 'thing', fam: 'vehicle', o: { type, ...extra } });
const B = (name, extra = {}) => ({ kind: 'thing', fam: 'building', o: { name, ...extra } });
const F = (type, extra = {}) => ({ kind: 'thing', fam: 'furniture', o: { type, ...extra } });
const FO = (type, extra = {}) => ({ kind: 'thing', fam: 'food', o: { type, ...extra } });
const FU = (type, extra = {}) => ({ kind: 'thing', fam: 'fun', o: { type, ...extra } });
const PL = (type, extra = {}) => ({ kind: 'thing', fam: 'plant', o: { type, ...extra } });
const T = (id, extra = {}) => ({ kind: 'thing', id, ...extra });               // existing builder id (farm, props, map models)

const noHorn = { horn: null, rainbow: false }, noAntl = { antlers: null, spots: false };
const pal = (side, back, belly) => ({ side, back: back || side, belly: belly || side, muzzle: belly || side, socks: back || side });

// [words separated by spaces (use _ inside multi-word names)] → spec
const ENTRIES = [
  // ---------- animals (voxel engine) ----------
  ['vache veau genisse cow calf heifer', A('vache')], ['taureau boeuf bison buffle yak bull ox buffalo', A('vache', { palette: pal('#7a4a2a', '#5a3620', '#c79a6a'), flags: { cowSpots: null } })],
  ['cochon porc porcelet truie pig piglet hog swine', A('cochon')], ['sanglier boar warthog phacochere', A('cochon', { palette: pal('#5a4030', '#45301f', '#8a6a4a') })],
  ['mouton brebis agneau belier sheep lamb ram', A('mouton')], ['chevre bouc goat chevreau', A('cerf', { flags: { ...noAntl, hornsSmall: '#e9dcc0' }, palette: pal('#a07a55', '#7d5a3a', '#e9dcc0'), size: 0.75 })],
  ['cheval jument etalon poulain poney horse mare stallion foal pony', A('licorne', { flags: { ...noHorn, morph: 'cheval' } })],
  ['zebre zebra', A('licorne', { flags: { ...noHorn, morph: 'cheval', zebra: true }, palette: { side: '#f4f4f4', back: '#f4f4f4', belly: '#f4f4f4', dark: '#1d1b20', muzzle: '#2b2b30', socks: '#f4f4f4', mane: '#1d1b20', nose: '#1d1b20' } })],
  ['ane mule donkey burro', A('licorne', { flags: { ...noHorn, morph: 'cheval' }, palette: { ...pal('#8f8a86', '#6e6966', '#d6d1cc'), mane: '#4a4542', muzzle: '#d6d1cc', socks: '#8f8a86' }, size: 0.85 })],
  ['chameau dromadaire lama alpaga camel dromedary llama alpaca', A('licorne', { flags: { ...noHorn, morph: 'cheval', hump: true, horseMane: false, shortMane: true }, palette: { ...pal('#d6b07a', '#b8915a', '#efdcb8'), mane: '#b8915a', muzzle: '#c9a06a', socks: '#d6b07a' } })],
  ['girafe giraffe', A('cerf', { flags: { ...noAntl, morph: 'girafe' }, size: 1.2 })],
  ['elephant mammouth mammoth', A('ours', { flags: { morph: 'elephant' }, size: 1.4 })],
  ['hippopotame hippo hippopotamus', A('cochon', { palette: pal('#8a7f9a', '#6f6580', '#d8b6c2'), size: 1.6 })],
  ['rhinoceros rhino', A('cochon', { palette: pal('#9a9a96', '#7c7c78', '#c4c4c0'), flags: { horn: '#e9e3d0' }, size: 1.5 })],
  ['lapin lievre rabbit bunny hare', A('chat', { flags: { morph: 'lapin' }, size: 0.6 })],
  ['hamster souris rat mulot gerbille mouse hamster gerbil', A('chat', { flags: { morph: 'souris' }, palette: pal('#c9a27a', '#a8825a', '#f2e2cc'), size: 0.45 })],
  ['ecureuil squirrel chipmunk tamia', A('renard', { palette: pal('#b5652e', '#8a4a22', '#f2dcc2'), size: 0.5 })],
  ['herisson hedgehog porc-epic porcupine', A('cochon', { palette: pal('#7a5a3a', '#5a4028', '#d9c2a0'), size: 0.45 })],
  ['singe gorille chimpanze orang-outan monkey ape gorilla chimp orangutan', A('ours', { flags: { morph: 'singe' }, size: 0.8 })],
  ['koala', A('panda', { palette: { side: '#9aa0a8', back: '#9aa0a8', belly: '#e6e6e6', dark: '#3a3d44', muzzle: '#e6e6e6', socks: '#7a8088' }, size: 0.6 })],
  ['raton-laveur raton raccoon blaireau badger', A('loup', { palette: pal('#8a8f98', '#5a5f68', '#d6d9de'), size: 0.55 })],
  ['kangourou kangaroo wallaby', A('cerf', { flags: noAntl, palette: pal('#b5784a', '#8a5a33', '#e6c9a8') })],
  ['leopard guepard jaguar lynx puma cougar ocelot leopard cheetah', A('tigre', { flags: { stripes: false, rosettes: true }, palette: { ...pal('#e8b84a', '#d9a63a', '#f6ecd0'), dark: '#2b2018' } })],
  ['panthere panther', A('tigre', { flags: { stripes: false }, palette: pal('#25232b', '#1a1920', '#3a3842') })],
  ['tigre tiger tigresse tigress', A('tigre')], ['lion', A('lion')], ['lionne lioness', A('lion', { flags: { mane: null } })],
  ['loup wolf louve husky malamute', A('loup')], ['hyene hyena coyote chacal jackal dingo', A('loup', { palette: pal('#a8895a', '#7d6640', '#d9c49c') })],
  ['renard fox fennec', A('renard')], ['chat chaton minou matou cat kitten kitty', A('chat')],
  ['chien chiot toutou labrador caniche berger dalmatien bulldog dog puppy doggo poodle', A('chien')],
  ['ours grizzly bear', A('ours')], ['ours_polaire polar_bear', A('ours', { palette: pal('#f4f4f2', '#e6e6e2', '#ffffff') })],
  ['panda', A('panda')], ['cerf biche faon renne elan caribou daim deer doe fawn reindeer moose elk', A('cerf')],
  ['licorne unicorn', A('licorne')], ['dragon wyvern dragonnet', A('dragon')],
  ['dinosaure dino t-rex trex raptor velociraptor dinosaur', A('dragon', { flags: { wings: false, spikes: null }, palette: pal('#5aa84a', '#3e8a35', '#c9e6a0') })],
  ['crocodile alligator caiman', A('dragon', { flags: { wings: false }, palette: pal('#4a7a3a', '#3a6230', '#a8c88a'), size: 0.9 })],
  // ---------- small creatures ----------
  ['oiseau bird moineau sparrow merle mesange canari canary', C('bird')], ['poule coq poussin chicken hen rooster chick', C('chicken')],
  ['canard cygne oie duck swan goose', C('duck')], ['hibou chouette owl', C('owl')], ['pingouin manchot penguin', C('penguin')],
  ['perroquet ara parrot macaw', C('parrot')], ['aigle faucon vautour eagle hawk falcon vulture', C('eagle', { scale: 1.5 })],
  ['corbeau corneille crow raven', C('bird', { color: '#2b2b33' })], ['pigeon colombe dove', C('bird', { color: '#9aa1ad' })],
  ['flamant flamingo', C('flamingo')], ['paon peacock', C('peacock')], ['autruche ostrich emeu emu', C('ostrich', { scale: 1.3 })],
  ['poisson fish carpe truite saumon thon poisson-rouge goldfish salmon trout tuna', C('fish')], ['requin shark', C('shark')],
  ['baleine whale orque orca', C('whale', { scale: 1.8 })], ['dauphin dolphin', C('dolphin')],
  ['papillon butterfly', C('butterfly')], ['abeille guepe bourdon bee wasp bumblebee', C('bee')], ['coccinelle ladybug ladybird', C('ladybug')],
  ['fourmi araignee scarabee insecte ant spider beetle bug insect', C('spider')],
  ['serpent cobra vipere python snake', C('snake', { color: '#4cc46a' })], ['ver lombric chenille worm caterpillar', C('worm', { color: '#ff8ac0' })],
  ['grenouille crapaud frog toad', C('frog')], ['tortue turtle tortoise', C('turtle')], ['lezard gecko iguane cameleon lizard iguana chameleon', C('lizard', { color: '#7bd35a' })],
  // ---------- vehicles ----------
  ['voiture auto automobile bagnole berline car sedan coupe cabriolet', V('car')], ['taxi cab', V('taxi', { color: '#ffd84d' })], ['voiture_de_police police_car', V('police', { color: '#f6f6f6' })],
  ['jeep 4x4 suv quad buggy', V('jeep', { color: '#3e8a35' })], ['camion camionnette fourgon van lorry truck pickup', V('truck')], ['bus autobus car_scolaire schoolbus coach', V('bus', { color: '#ffc93c' })],
  ['camion_de_pompiers pompiers firetruck fire_truck', V('firetruck', { color: '#e8413a' })], ['bateau navire barque canot yacht peniche boat ship yacht canoe', V('boat')], ['voilier sailboat', V('sailboat', { color: '#f6f6f6' })],
  ['avion jet airplane plane aircraft avion_de_chasse fighter', V('plane')], ['helicoptere helicopter heli', V('helicopter')], ['fusee vaisseau navette rocket spaceship shuttle', V('rocket', { color: '#e8413a' })],
  ['velo bicyclette moto scooter trottinette bike bicycle motorbike motorcycle', V('bike')], ['train locomotive tram metro wagon', V('train', { color: '#3f86ff' })],
  // ---------- buildings ----------
  ['ecole college lycee school', B('School', { sign: 'ÉCOLE', accent: '#3f86ff' })], ['hopital clinique hospital clinic', B('Hospital', { sign: 'HÔPITAL', accent: '#e8413a', cross: true, color: '#f6f6f6', floors: 3 })],
  ['banque bank', B('Bank', { sign: 'BANQUE', accent: '#3e8a35', mat: 'Marble', color: '#e9e2d0' })], ['hotel hostel', B('Hotel', { sign: 'HÔTEL', accent: '#9a5cff', floors: 4 })],
  ['restaurant resto diner', B('Restaurant', { sign: 'RESTAURANT', accent: '#e8413a' })], ['cafe coffee', B('Cafe', { sign: 'CAFÉ', accent: '#8a5a33', floors: 1 })],
  ['boulangerie patisserie bakery', B('Bakery', { sign: 'BOULANGERIE', accent: '#ff9a3c', floors: 1 })], ['pharmacie pharmacy', B('Pharmacy', { sign: 'PHARMACIE', accent: '#3e8a35', floors: 1 })],
  ['poste post_office', B('PostOffice', { sign: 'POSTE', accent: '#ffd84d' })], ['mairie hotel_de_ville town_hall city_hall', B('TownHall', { sign: 'MAIRIE', accent: '#3f86ff', mat: 'Marble', color: '#e9e2d0', tower: true })],
  ['musee museum', B('Museum', { sign: 'MUSÉE', accent: '#9a5cff', mat: 'Marble', color: '#e9e2d0' })], ['cinema theatre movie_theater', B('Cinema', { sign: 'CINÉMA', accent: '#e8413a' })],
  ['gare station', B('Station', { sign: 'GARE', accent: '#3f86ff', w: 22 })], ['magasin boutique_de_vetements store shop', B('Store', { sign: 'MAGASIN', accent: '#ff8ac0', floors: 1 })],
  ['supermarche supermarket mall centre_commercial', B('Supermarket', { sign: 'SUPERMARCHÉ', accent: '#4cc46a', w: 26, floors: 1 })], ['commissariat police_station', B('PoliceStation', { sign: 'POLICE', accent: '#3f86ff' })],
  ['caserne fire_station', B('FireStation', { sign: 'POMPIERS', accent: '#e8413a' })], ['eglise chapelle cathedrale church chapel cathedral', B('Church', { mat: 'Cobblestone', color: '#d6d0c4', tower: true, floors: 2 })],
  ['bibliotheque library', B('Library', { sign: 'BIBLIOTHÈQUE', accent: '#8a5a33' })], ['usine factory atelier workshop', B('Factory', { color: '#9aa1ad', mat: 'Concrete', w: 24, sign: 'USINE', accent: '#ff9a3c' })],
  ['bureau office entreprise', B('Office', { floors: 4, color: '#cfd8e3', mat: 'Concrete' })], ['garage', B('Garage', { floors: 1, color: '#9aa1ad', mat: 'Concrete', sign: 'GARAGE', accent: '#2b2b33' })],
  ['immeuble appartement apartment building', B('Apartment', { floors: 5 })], ['gratte-ciel gratte_ciel skyscraper', T('skyscraper')],
  ['tour tower donjon tourelle', T('roundTower')], ['phare lighthouse', T('lighthouse')], ['cabane chalet hutte refuge cabin hut lodge', T('hut')],
  ['villa manoir mansion', B('Mansion', { floors: 2, w: 22, color: '#f6f1e6', roof: '#7a3a2a' })],
  // ---------- furniture ----------
  ['table bureau_table desk', F('table')], ['chaise tabouret chair stool', F('chair')], ['lit bed', F('bed')], ['canape sofa couch', F('sofa')],
  ['etagere shelf bookshelf', F('shelf')], ['lampe lamp', F('lamp')], ['tele television tv', F('tv')], ['ordinateur pc computer laptop', F('computer')],
  ['piano', F('piano')], ['armoire placard commode wardrobe cupboard closet dresser', F('wardrobe')],
  // ---------- food ----------
  ['pomme apple', FO('apple')], ['orange mandarine clementine', FO('orange')], ['cerise cherry', FO('cherry')], ['tomate tomato', FO('tomato')],
  ['pasteque melon watermelon', FO('watermelon')], ['banane banana', FO('banana')], ['gateau tarte cake pie', FO('cake')], ['donut beignet doughnut', FO('donut')],
  ['pizza', FO('pizza')], ['burger hamburger cheeseburger', FO('burger')], ['glace sorbet ice_cream icecream', FO('icecream')],
  ['bonbon sucette candy lollipop', FO('lollipop')], ['cookie biscuit', FO('cookie')],
  // ---------- fun, sport, seasons, sky ----------
  ['ballon_de_baudruche balloon baudruche', FU('balloon')], ['cadeau gift surprise', FU('gift')], ['drapeau flag banniere', FU('flag')],
  ['cage_de_foot goal football_goal but_de_foot', FU('goal')], ['panier_de_basket basket hoop basketball', FU('hoop')], ['toboggan slide', FU('slide')], ['balancoire swing', FU('swing')],
  ['trampoline', FU('trampoline')], ['piscine pool swimming_pool', FU('pool')], ['parasol umbrella plage_parasol', FU('umbrella')],
  ['bonhomme_de_neige snowman', FU('snowman')], ['sapin_de_noel arbre_de_noel christmas_tree xmas_tree', FU('xmastree')], ['tombe tombeau pierre_tombale grave tomb tombstone', FU('grave')],
  ['soleil sun', FU('sun')], ['lune moon', FU('moon')], ['etoile star', FU('star')], ['coeur heart', FU('heart')], ['arc-en-ciel arc_en_ciel rainbow', FU('rainbow')],
  // ---------- plants ----------
  ['palmier cocotier palm palm_tree coconut_tree', PL('palm')], ['arbre_mort dead_tree', PL('dead')], ['bambou bamboo', PL('bamboo')],
  ['rose tulipe marguerite lys orchidee lavande coquelicot pensee jonquille rose tulip daisy lily orchid poppy daffodil', PL('flower')],
  ['plante pot plant potted_plant', PL('potted')], ['haie hedge', PL('hedge')], ['liane lierre vine ivy', PL('vine')],
  // ---------- fruit & vegetables (giant, simulator style) ----------
  ['fraise framboise strawberry raspberry', FO('cherry', { color: '#e8304a' })], ['raisin grappe grape grapes', FO('cherry', { color: '#7a3ab0' })], ['myrtille blueberry cassis', FO('cherry', { color: '#3a3ab0' })],
  ['citron lemon lime', FO('orange', { color: '#fff04d' })], ['poire pear', FO('apple', { color: '#b8d94a' })], ['peche abricot peach apricot nectarine', FO('apple', { color: '#ffb07a' })], ['prune plum', FO('apple', { color: '#7a2a6a' })],
  ['kiwi', FO('apple', { color: '#8a6a3a' })], ['ananas pineapple', FO('orange', { color: '#ffc93c' })], ['noix_de_coco coconut', FO('apple', { color: '#6b4426' })], ['avocat avocado', FO('apple', { color: '#3e7a35' })],
  ['mangue papaye mango papaya', FO('apple', { color: '#ffa53a' })], ['grenade pomegranate', FO('apple', { color: '#c0102a' })], ['figue datte fig date', FO('apple', { color: '#6a3a5a' })],
  ['brocoli broccoli chou cabbage salade laitue lettuce epinard spinach', FO('apple', { color: '#4e9a3a' })], ['aubergine eggplant', FO('apple', { color: '#5a2a7a' })], ['poivron pepper piment chili', FO('apple', { color: '#e8302a' })],
  ['oignon onion ail garlic navet turnip radis radish betterave beet', FO('apple', { color: '#e8c8d8' })], ['pomme_de_terre patate potato', FO('apple', { color: '#c9a06a' })], ['concombre courgette cucumber zucchini', FO('banana', { color: '#3e8a35' })],
  ['oeuf_au_plat egg_food', FO('cookie', { color: '#fff3d6' })], ['fromage cheese', FO('cake', { color: '#ffd84d' })], ['pain baguette bread croissant', FO('banana', { color: '#d9a066' })], ['chocolat chocolate', FO('cookie', { color: '#5a3620' })],
  ['crepe pancake gaufre waffle', FO('cookie', { color: '#e6b56a' })], ['muffin cupcake macaron', FO('cake', { color: '#ff8ac0', scale: 0.8 })], ['popcorn barbe_a_papa cotton_candy', FO('icecream', { color: '#ff8ac0' })],
  ['sushi onigiri', FO('cookie', { color: '#f6f6f6' })], ['hot-dog hotdog saucisse sausage', FO('banana', { color: '#c0603a' })], ['frites fries chips', FO('banana', { color: '#ffd84d', scale: 0.6 })], ['soupe soup', FO('cake', { color: '#ff9a3c' })],
  // ---------- more buildings & shops ----------
  ['boucherie butcher', B('Butcher', { sign: 'BOUCHERIE', accent: '#c0392b', floors: 1 })], ['fleuriste florist flower_shop', B('Florist', { sign: 'FLEURISTE', accent: '#ff8ac0', floors: 1 })],
  ['librairie bookstore bookshop', B('Bookstore', { sign: 'LIBRAIRIE', accent: '#8a5a33', floors: 1 })], ['coiffeur salon barber hairdresser', B('Barber', { sign: 'COIFFEUR', accent: '#9a5cff', floors: 1 })],
  ['pizzeria', B('Pizzeria', { sign: 'PIZZERIA', accent: '#e8413a', floors: 1 })], ['glacier ice_cream_shop', B('IceCreamShop', { sign: 'GLACES', accent: '#ff8ac0', floors: 1 })], ['fast-food fastfood fast_food burger_shop', B('FastFood', { sign: 'BURGER', accent: '#ffc93c', floors: 1 })],
  ['creche maternelle kindergarten nursery', B('Kindergarten', { sign: 'CRÈCHE', accent: '#ffd84d', floors: 1 })], ['universite fac university campus', B('University', { sign: 'UNIVERSITÉ', accent: '#1d3f88', floors: 3, mat: 'Marble', color: '#e9e2d0', tower: true })],
  ['laboratoire labo laboratory lab', B('Laboratory', { sign: 'LABO', accent: '#3ee6ff', color: '#f6f6f6', mat: 'Concrete' })], ['prison jail', B('Prison', { color: '#7d7f86', mat: 'Concrete', floors: 2, sign: 'PRISON', accent: '#2b2b33' })],
  ['stade arena_sport stadium', B('Stadium', { w: 30, d: 24, floors: 2, color: '#cfd8e3', mat: 'Concrete', sign: 'STADE', accent: '#3f86ff' })], ['piscine_municipale swimming_center aquatic_center', B('AquaticCenter', { sign: 'PISCINE', accent: '#3ee6ff', w: 24 })],
  ['gymnase salle_de_sport gym', B('Gym', { sign: 'SPORT', accent: '#ff9a3c', w: 22 })], ['zoo', B('Zoo', { sign: 'ZOO', accent: '#4cc46a', floors: 1, w: 20 })], ['aeroport airport', B('Airport', { sign: 'AÉROPORT', accent: '#3f86ff', w: 30, floors: 2, mat: 'Concrete', color: '#cfd8e3' })],
  ['port harbour harbor', B('Harbour', { sign: 'PORT', accent: '#1d3f88', floors: 1 })], ['station-service essence gas_station', B('GasStation', { sign: 'ESSENCE', accent: '#e8413a', floors: 1 })], ['parking car_park parking_lot', B('Parking', { floors: 3, color: '#9aa1ad', mat: 'Concrete' })],
  ['ferme_eolienne eolienne wind_turbine', T('windmill')], ['moulin_a_vent', T('windmill')], ['pagode pagoda', T('temple')], ['mosquee mosque synagogue', B('Mosque', { color: '#f2ead8', mat: 'Marble', tower: true })],
  ['igloo', FU('snowman', { color: '#e6ecf7' })], ['chapiteau cirque circus', B('Circus', { sign: 'CIRQUE', accent: '#e8413a', floors: 1, color: '#ffd84d', mat: 'Fabric' })], ['tipi teepee yourte yurt', T('tent')],
  ['moulin_a_eau watermill', T('windmill')], ['pont bridge viaduc', T('bridge')], ['mur muraille wall rempart', B('Wall', { floors: 1, w: 24, d: 3, mat: 'Cobblestone', color: '#9aa1ad' })], ['tour_de_garde watchtower', T('roundTower')],
  // ---------- more vehicles ----------
  ['ambulance', V('truck', { color: '#f6f6f6', name: 'Ambulance' })], ['bulldozer tractopelle pelleteuse grue excavator crane digger', V('truck', { color: '#ffc93c', name: 'Excavator' })], ['benne camion_poubelle garbage_truck', V('truck', { color: '#4cc46a', name: 'GarbageTruck' })],
  ['limousine limo', V('car', { color: '#14141c', scale: 1.3 })], ['course voiture_de_course race_car racecar formule1 f1', V('car', { color: '#e8413a', name: 'RaceCar' })], ['kart karting go-kart', V('car', { color: '#ffd84d', scale: 0.6 })],
  ['sous-marin submarine', V('boat', { color: '#ffd84d', name: 'Submarine' })], ['paquebot cruise_ship', V('boat', { color: '#f6f6f6', scale: 2 })], ['pirogue kayak', V('boat', { color: '#8a5a33', scale: 0.6 })], ['jet-ski jetski', V('boat', { color: '#3ee6ff', scale: 0.4 })],
  ['montgolfiere hot_air_balloon', FU('balloon', { color: '#ff9a3c' })], ['soucoupe ovni ufo', V('helicopter', { color: '#9aa1ad', name: 'UFO' })], ['char tank', V('jeep', { color: '#4a5a3a', name: 'Tank' })], ['skate skateboard', V('bike', { color: '#ff9a3c', name: 'Skateboard' })],
  // ---------- more furniture & home ----------
  ['fauteuil armchair', F('sofa', { color: '#3f86ff', name: 'Armchair' })], ['pouf beanbag', F('sofa', { color: '#ff8ac0', name: 'Beanbag' })], ['bureau_ecole desk_school', F('table')], ['frigo refrigerateur fridge refrigerator', F('wardrobe', { color: '#f6f6f6', name: 'Fridge' })],
  ['four cuisiniere oven stove', F('wardrobe', { color: '#2b2b33', name: 'Oven' })], ['baignoire bathtub', F('bed', { color: '#f6f6f6', name: 'Bathtub' })], ['toilettes toilet', F('chair', { color: '#f6f6f6', name: 'Toilet' })],
  ['horloge pendule clock', F('lamp', { color: '#8a5a33', name: 'Clock' })], ['miroir mirror', F('wardrobe', { color: '#c9d1dd', name: 'Mirror' })], ['tapis carpet rug', F('table', { color: '#c0392b', name: 'Rug' })], ['console jeu_video video_game arcade borne_d_arcade', F('tv', { name: 'Arcade' })],
  ['guitare guitar violon violin batterie drums trompette trumpet', F('piano', { name: 'Instrument' })], ['jouet toy peluche teddy nounours teddy_bear', FU('gift', { color: '#c99b6b', name: 'Teddy' })],
  // ---------- more fun / sport / magic ----------
  ['ballon_de_foot football soccer_ball', FU('goal')], ['tennis raquette tennis_court', FU('goal', { name: 'TennisNet' })], ['ring boxe boxing', FU('trampoline', { name: 'Ring' })], ['manege carrousel carousel merry-go-round', FU('trampoline', { color: '#ff8ac0', name: 'Carousel' })],
  ['grande_roue ferris_wheel', FU('rainbow', { name: 'FerrisWheel' })], ['feu_d_artifice fireworks firework', FU('star', { color: '#ff3bd0' })], ['confettis confetti', FU('balloon', { color: '#ffd84d' })], ['guirlande garland', FU('flag', { color: '#ffd84d' })],
  ['citrouille_d_halloween jack-o-lantern', T('pumpkins')], ['fantome ghost spectre', FU('snowman', { color: '#e6f0ff', name: 'Ghost' })], ['squelette skeleton', FU('grave', { name: 'Skeleton' })], ['zombie zombi', FU('grave', { name: 'Zombie' })],
  ['portail_magique magic_portal', T('worldGate')], ['baguette_magique wand', T('torch')], ['potion fiole', FO('cherry', { color: '#9a5cff' })], ['chaudron cauldron', T('barrel')], ['grimoire spellbook', F('shelf', { name: 'Spellbook' })],
  ['epee sword hache axe bouclier shield arc bow lance spear', T('trophy')], ['canon cannon', V('jeep', { color: '#2b2b33', name: 'Cannon' })], ['robot androide android mecha', FU('snowman', { color: '#9aa1ad', name: 'Robot' })], ['ange angel', FU('heart', { color: '#fff3c4' })],
  // ---------- more plants ----------
  ['tulipes_rouges red_tulips', PL('flower', { color: '#e8413a' })], ['bouquet', PL('flower')], ['buissons_fleuris flower_bush', PL('flower')], ['saule willow bouleau birch erable maple peuplier poplar', T('oak')], ['olivier olive_tree pommier apple_tree oranger orange_tree', T('oak')],
  ['epicea spruce cypres cypress cedre cedar', T('pine')], ['nenuphar lotus water_lily', T('pond')], ['herbe grass gazon pelouse lawn', PL('hedge', { name: 'Grass' })], ['roseau reed jonc', PL('bamboo')], ['mousse moss', PL('vine')], ['algue seaweed corail coral', PL('vine', { color: '#ff7a6b' })],
  // ---------- more animals ----------
  ['poney_magique pegase pegasus', A('licorne', { flags: { horn: null, rainbow: false }, wings: true, palette: pal('#f6f6fb', '#e6e6f0', '#ffffff') })], ['griffon griffin hippogriffe hippogriff', A('lion', { wings: true })], ['phoque otarie seal sea_lion morse walrus', C('seal')],
  ['pieuvre poulpe octopus calamar squid meduse jellyfish', C('octopus')], ['crabe homard crevette crab lobster shrimp', C('crab')], ['escargot limace snail slug', C('snail')],
  ['chauve-souris bat', C('bat')], ['dragonfly libellule mouche fly moustique mosquito', C('bee', { color: '#3ee6ff' })], ['tamanoir fourmilier anteater tatou armadillo paresseux sloth', A('ours', { palette: pal('#8a7a6a', '#6a5a4a', '#c9b8a0'), size: 0.7 })],
  ['loutre otter castor beaver taupe mole furet ferret belette weasel', A('renard', { palette: pal('#6b4a33', '#4a3322', '#c9a07a'), size: 0.5 })], ['tigre_blanc white_tiger', A('tigre', { palette: { side: '#f6f4ee', back: '#f6f4ee', belly: '#ffffff', dark: '#2b2b33', muzzle: '#ffffff', socks: '#ffffff' } })],
  ['loup_garou werewolf', A('loup', { palette: pal('#4a4040', '#2e2828', '#8a7a7a'), size: 1.5 })], ['chien_de_garde guard_dog', A('chien', { palette: pal('#2b2523', '#1a1614', '#a87a4a') })], ['chat_noir black_cat', A('chat', { palette: pal('#25232b', '#1a1920', '#3a3842') })],
  // ---------- farm & props & map models (existing builders) ----------
  ['grange etable barn stable', T('barn')], ['silo', T('silo')], ['foin meule botte hay haystack', T('hay')], ['champ ble mais wheat field corn', T('field')],
  ['carotte carrot', T('carrots')], ['citrouille potiron pumpkin', T('pumpkins')], ['enclos pen paddock corral', T('pen')], ['abreuvoir trough', T('trough')],
  ['tracteur tractor', T('tractor')], ['epouvantail scarecrow', T('scarecrow')],
  ['maison house home', T('house')], ['chateau castle forteresse fortress palais palace', T('castle')], ['temple pyramide pyramid', T('temple')], ['moulin windmill', T('windmill')],
  ['statue monument', T('statue')], ['cascade waterfall chute', T('waterfall')], ['volcan volcano', T('volcano')], ['nuage cloud', T('cloud')],
  ['arbre chene tree oak', T('oak')], ['sapin pin pine fir', T('pine')], ['cerisier sakura cherry_tree', T('cherry')], ['cactus', T('cactus')], ['fleur flower', T('flowers')], ['foret bois forest woods', T('forest')],
  ['banc bench', T('bench')], ['tonneau baril barrel', T('barrel')], ['caisse crate box', T('crates')], ['puits well', T('well')], ['marche etal stall market', T('stall')],
  ['tente tent', T('tent')], ['lanterne lantern', T('lantern')], ['feu_de_camp campfire bonfire', T('campfire')], ['panneau pancarte sign signpost', T('signpost')],
  ['fontaine fountain', T('fountain')], ['buisson bush shrub', T('bush')], ['champignon mushroom', T('mushroom')], ['souche stump', T('stump')], ['mare etang lac pond lake', T('pond')],
  ['tournesol sunflower', T('sunflowers')], ['arche arch', T('rockArch')], ['rocher roche pierre rock boulder stone', T('rockCluster')], ['plateforme platform ile_flottante', T('grassPlatform')],
  ['buche buches logs log_pile', T('logPile')], ['echelle ladder', T('ladder')], ['oeuf egg', T('eggPedestal')], ['porte portail gate portal', T('worldGate')],
  ['boutique stand shop_booth', T('shopBooth')], ['coffre tresor chest treasure', T('chest')], ['gemme diamant cristal_precieux gem diamond jewel', T('gemPile')],
  ['piece_d_or pieces_d_or coin coins gold_coins', T('coinPile')], ['trophee coupe trophy cup', T('trophy')], ['classement leaderboard', T('leaderboardStand')],
  ['obelisque obelisk', T('obelisk')], ['ruine ruins', T('ruins')], ['torche torch flambeau', T('torch')], ['cristal crystal', T('crystalTree')],
  ['lampadaire reverbere streetlight street_lamp', T('streetLamp')], ['arret_de_bus bus_stop', T('busStop')], ['bouche_d_incendie hydrant fire_hydrant', T('hydrant')], ['plot cone traffic_cone', T('trafficCone')],
];

// multi-word names joined before lookup (longest first)
export let PHRASES = [];

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function plurals(w) { const out = new Set([w]);
  if (w.includes('_')) { const [h, ...t] = w.split('_'); for (const p of plurals(h)) out.add([p, ...t].join('_')); return out; }
  if (/[sxz]$/.test(w)) return out;
  if (/al$/.test(w)) out.add(w.slice(0, -2) + 'aux'); if (/(eau|eu|au)$/.test(w)) out.add(w + 'x'); if (/ou$/.test(w)) out.add(w + 'x');
  if (/[^aeiou]y$/.test(w)) out.add(w.slice(0, -1) + 'ies'); if (/(ch|sh)$/.test(w)) out.add(w + 'es'); if (/o$/.test(w)) out.add(w + 'es');
  out.add(w + 's'); return out; }
export const LEX = new Map();
for (const [words, spec] of ENTRIES) for (const raw of words.split(' ')) { const w = strip(raw).replace(/-/g, '_'); if (!w) continue; for (const f of plurals(w)) if (!LEX.has(f)) LEX.set(f, spec); }
export const LEX_SIZE = LEX.size;
// multi-word names (and their plurals: « voitures de course ») joined before lookup, longest first
PHRASES = [...LEX.keys()].filter((w) => w.includes('_')).map((w) => w.split('_').join(' ')).sort((a, b) => b.length - a.length);
