"""Roblox Forge - Blender pipeline (runs headless: blender -b -P forge_blender.py -- ...).

  pet  <pet.json> <out_dir> [--hd] [--render SIZE] [--samples N]
       Rebuilds a Forge pet from its Roblox parts. --hd fuses the parts that
       share a colour and material into one smooth organic skin (voxel remesh,
       smoothing, decimation within Roblox's 20k-triangle MeshPart limit) and
       exports <name>.glb + <name>.fbx. --render writes a studio render.
  map  <map.json> <out_dir> [--render WIDTH] [--samples N]
       Builds a Forge map and renders a cinematic cover (16:9) + a square icon.

Coordinates: Roblox is Y-up, front = -Z; Blender is Z-up. A Roblox point
(x, y, z) becomes (x, -z, y). Rotations are Euler XYZ in degrees (CFrame.Angles).
"""
import bpy, bmesh, json, math, os, re, sys
from mathutils import Matrix, Vector, Euler

C4 = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # Roblox -> Blender basis


def hexrgb(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


def rbx_matrix(p):
    sx, sy, sz = p['size'] if p.get('shape') != 'Ball' else [p['size'][0]] * 3
    rx, ry, rz = (math.radians(v) for v in p.get('rot', (0, 0, 0)))
    R = Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rz, 4, 'Z')  # = CFrame.Angles
    S = Matrix.Diagonal((sx, sy, sz, 1))
    return C4 @ Matrix.Translation(Vector(p['pos'])) @ R @ S


# ---------------------------------------------------------------- primitives (Roblox local space)
def prim_mesh(kind, seg=48):
    me = bpy.data.meshes.new(kind)
    bm = bmesh.new()
    if kind in ('Ellipsoid', 'Ball'):
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=0.5)
    elif kind == 'Cylinder':  # axis along local X, like Roblox
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=0.5, radius2=0.5, depth=1.0)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'))
    elif kind in ('Wedge', 'WedgePart'):  # slope from front-bottom (-Z) to back-top (+Z)
        pts = [(-0.5, -0.5, -0.5), (-0.5, -0.5, 0.5), (-0.5, 0.5, 0.5), (0.5, -0.5, -0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5)]
        v = [bm.verts.new(q) for q in pts]
        for f in ((0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (0, 2, 5, 3)):
            bm.faces.new([v[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    elif kind == 'CornerWedgePart':
        pts = [(-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (0.5, -0.5, 0.5), (-0.5, -0.5, 0.5), (0.5, 0.5, -0.5)]
        v = [bm.verts.new(q) for q in pts]
        for f in ((0, 2, 1), (0, 3, 2), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)):
            bm.faces.new([v[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    return me


_prims = {}


def prim(kind):
    k = 'Wedge' if kind == 'WedgePart' else kind
    if k not in _prims:
        _prims[k] = prim_mesh(k, 24 if k == 'Cylinder' else 40)
    return _prims[k]


# ---------------------------------------------------------------- materials (Roblox look, path traced)
_mats = {}


def material(color, mat, transparency=0.0):
    key = (color, mat, round(transparency, 2))
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f'{mat}_{color}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    rgba = hexrgb(color)
    b.inputs['Base Color'].default_value = rgba
    rough = {'SmoothPlastic': 0.32, 'Plastic': 0.55, 'Metal': 0.28, 'Foil': 0.12, 'DiamondPlate': 0.3, 'Glass': 0.04, 'Ice': 0.08, 'Fabric': 0.9, 'Marble': 0.2,
             'Neon': 0.4, 'Slate': 0.85, 'Basalt': 0.8, 'Granite': 0.6, 'Grass': 0.95, 'LeafyGrass': 0.95, 'Sand': 0.98, 'Snow': 0.9, 'Wood': 0.7, 'WoodPlanks': 0.7}.get(mat, 0.6)
    b.inputs['Roughness'].default_value = rough
    if mat in ('Metal', 'Foil', 'DiamondPlate', 'CorrodedMetal'):
        b.inputs['Metallic'].default_value = 1.0
    if mat == 'Neon':
        b.inputs['Emission Color'].default_value = rgba
        b.inputs['Emission Strength'].default_value = 7.0
    if mat in ('Glass', 'Ice', 'Glacier'):
        b.inputs['Transmission Weight'].default_value = 0.92
        b.inputs['IOR'].default_value = 1.35
    if mat == 'ForceField':
        b.inputs['Emission Color'].default_value = rgba
        b.inputs['Emission Strength'].default_value = 2.0
        transparency = max(transparency, 0.65)
    if mat == 'Fabric':
        b.inputs['Sheen Weight'].default_value = 0.6
    if mat in ('SmoothPlastic', 'Plastic'):
        b.inputs['Coat Weight'].default_value = 0.25 if mat == 'SmoothPlastic' else 0.0
        b.inputs['Subsurface Weight'].default_value = 0.08  # soft "toy" look
        b.inputs['Subsurface Radius'].default_value = (0.4, 0.2, 0.15)
    if transparency > 0.01:
        b.inputs['Alpha'].default_value = max(0.05, 1 - transparency)
        m.blend_method = 'BLEND'
    _mats[key] = m
    return m


def build_parts(parts, coll):
    objs = []
    for i, p in enumerate(parts):
        shape = p.get('shape') or ('Wedge' if p.get('cls') == 'WedgePart' else 'Block')
        if p.get('cls') == 'CornerWedgePart':
            shape = 'CornerWedgePart'
        if p.get('cls') == 'WedgePart':
            shape = 'Wedge'
        o = bpy.data.objects.new(p.get('name', f'Part{i}'), prim(shape))
        o.matrix_world = rbx_matrix(p)
        o.data = o.data.copy()
        o.data.materials.append(material(p.get('color', '#a3a2a5'), p.get('material', 'Plastic'), p.get('transparency', 0) or 0))
        o['forge_shape'] = shape
        o['forge_group'] = f"{p.get('color')}|{p.get('material')}|{round(p.get('transparency', 0) or 0, 2)}"
        coll.objects.link(o)
        if shape in ('Ellipsoid', 'Ball', 'Cylinder'):
            for f in o.data.polygons:
                f.use_smooth = True
        objs.append(o)
    return objs


def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def tri_count(o):
    return sum(len(f.vertices) - 2 for f in o.data.polygons)


def fuse_hd(objs, scale):
    """Organic groups (same colour + material, round shapes) become one seamless smooth skin."""
    groups = {}
    for o in objs:
        groups.setdefault(o['forge_group'], []).append(o)
    out = []
    for key, members in groups.items():
        organic = all(m['forge_shape'] in ('Ellipsoid', 'Ball', 'Cylinder') for m in members)
        bpy.ops.object.select_all(action='DESELECT')
        for m in members:
            m.select_set(True)
        bpy.context.view_layer.objects.active = members[0]
        if len(members) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = members[0].name if len(members) == 1 else f'Skin_{len(out) + 1}'
        dims = max(o.dimensions)
        if organic and dims > 0.25 * scale and len(o.data.polygons) > 0:
            r = o.modifiers.new('Remesh', 'REMESH')
            r.mode = 'VOXEL'
            r.voxel_size = max(0.018 * scale, dims / 220)
            r.adaptivity = 0.0
            s = o.modifiers.new('Smooth', 'CORRECTIVE_SMOOTH')
            s.iterations = 6
            s.smooth_type = 'LENGTH_WEIGHTED'
            s.use_only_smooth = True
            apply_mods(o)
            target = 9000 if dims > 1.2 * scale else 3000
            if tri_count(o) > target:
                d = o.modifiers.new('Decimate', 'DECIMATE')
                d.ratio = target / tri_count(o)
                apply_mods(o)
            for f in o.data.polygons:
                f.use_smooth = True
            o.data.shade_smooth() if hasattr(o.data, 'shade_smooth') else None
        out.append(o)
    return out


# ---------------------------------------------------------------- studio scene
def studio(target_center, radius, accent='#7c5cff', size=1024, samples=96, square=True, width=None):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.filter_width = 1.8  # softer grain without a denoiser
    sc.render.resolution_x = width or size
    sc.render.resolution_y = size if square else int((width or size) * 9 / 16)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    sc.view_settings.look = 'None'
    cx, cy, cz = target_center
    # curved backdrop in the accent colour
    bpy.ops.mesh.primitive_plane_add(size=radius * 14, location=(cx, cy - radius * 2, 0))
    floor = bpy.context.object
    bm = bmesh.new(); bm.from_mesh(floor.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=40, use_grid_fill=True)
    for v in bm.verts:
        if v.co.y < 0:
            v.co.z = (abs(v.co.y) / (radius * 7)) ** 2 * radius * 6
    bm.to_mesh(floor.data); bm.free()
    for f in floor.data.polygons:
        f.use_smooth = True
    fm = bpy.data.materials.new('Backdrop'); fm.use_nodes = True
    fb = fm.node_tree.nodes['Principled BSDF']
    fb.inputs['Base Color'].default_value = hexrgb(accent); fb.inputs['Roughness'].default_value = 0.6
    floor.data.materials.append(fm)
    floor.location = (cx, cy - radius * 1.5, 0)
    world = bpy.data.worlds.new('World'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = hexrgb(accent)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35

    def area(name, loc, energy, color, sz):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l = bpy.context.object; l.name = name; l.data.energy = energy; l.data.color = hexrgb(color)[:3]; l.data.size = sz
        d = Vector(target_center) - l.location; l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area('Key', (cx - radius * 2.2, cy + radius * 2.6, cz + radius * 2.8), 900 * radius ** 2 / 4, '#fff4e6', radius * 1.6)
    area('Rim', (cx + radius * 2.4, cy - radius * 2.5, cz + radius * 2.2), 700 * radius ** 2 / 4, '#8fe9ff', radius * 1.2)
    area('Fill', (cx + radius * 2.8, cy + radius * 1.6, cz + radius * 0.6), 260 * radius ** 2 / 4, '#ffffff' if bpy.context.scene.get('forge_side', 0) else '#ffd6f5', radius * 2.0)
    # camera: 3/4 front (the pet looks towards +Y in Blender)
    side = bpy.context.scene.get('forge_side', 0)
    bpy.ops.object.camera_add(location=(cx + radius * 3.2, cy + radius * 2.7, cz + radius * 1.2) if side else (cx - radius * 1.25, cy + radius * 3.0, cz + radius * 0.85))
    cam = bpy.context.object; sc.camera = cam
    d = Vector(target_center) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 85
    cam.data.dof.use_dof = True; cam.data.dof.focus_distance = d.length; cam.data.dof.aperture_fstop = 5.6
    # glow on neon parts (compositor glare)
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); comp = nt.nodes.new('CompositorNodeComposite')
    gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'; gl.threshold = 1.0; gl.size = 8
    nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], comp.inputs['Image'])
    return cam


def bounds(objs):
    mn, mx = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


RAR_ACCENT = {'voxel': '#4f8fff', 'Commun': '#4a4f63', 'Rare': '#1f4f9a', 'Épique': '#4b2a8f', 'Légendaire': '#8a5a10', 'Mythique': '#8a1f45', 'Divin': '#3a7a8f', 'Secret 1/1B': '#3b1f6b'}


def cmd_pet(src, out, hd, render, samples):
    data = json.load(open(src))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new('Pet'); bpy.context.scene.collection.children.link(coll)
    objs = build_parts(data['parts'], coll)
    if data.get('style') == 'voxel':
        for o in objs:
            bv = o.modifiers.new('Bevel', 'BEVEL'); bv.width = 0.012; bv.segments = 2; bv.limit_method = 'NONE'
    mn, mx = bounds(objs); size = (mx - mn).length
    qa = None
    if hd:
        objs = fuse_hd(objs, max(size / 4, 0.5))
        qa = asset_qa(objs)  # clean before export
    name = ''.join(ch for ch in data.get('name', 'Pet') if ch.isalnum()) or 'Pet'
    os.makedirs(out, exist_ok=True)
    report = {'name': data.get('name'), 'parts': len(data['parts']), 'meshes': len(objs), 'triangles': sum(tri_count(o) for o in objs)}
    if hd:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, name + '.glb'), use_selection=True, export_apply=True, export_yup=True)
        bpy.ops.export_scene.fbx(filepath=os.path.join(out, name + '.fbx'), use_selection=True, apply_unit_scale=True, axis_forward='-Z', axis_up='Y', bake_space_transform=True)
        report['export'] = [name + '.glb', name + '.fbx']
        report['qa'] = qa
        report['maxTrianglesPerMesh'] = max(tri_count(o) for o in objs)
    if render:
        mn, mx = bounds(objs); c = (mn + mx) / 2; r = max((mx - mn).length / 2, 0.5)
        bpy.context.scene['forge_side'] = 1 if data.get('style') == 'voxel' else 0
        studio(tuple(c), r, RAR_ACCENT['voxel'] if data.get('style') == 'voxel' else RAR_ACCENT.get(data.get('rarity'), '#3b1f6b'), render, samples)
        bpy.context.scene.render.filepath = os.path.join(out, name + ('_hd' if hd else '') + '.png')
        bpy.ops.render.render(write_still=True)
        report['render'] = os.path.basename(bpy.context.scene.render.filepath)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False)
    print('FORGE', json.dumps(report, ensure_ascii=False))


def flatten(node, out):
    if node.get('children') is not None and node.get('cls') in ('Model', 'Folder', None):
        for c in node['children']:
            flatten(c, out)
    elif 'pos' in node:
        out.append(node)
    return out


def cmd_map(src, out, width, samples):
    data = json.load(open(src))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new('Map'); bpy.context.scene.collection.children.link(coll)
    parts = flatten(data['root'], [])
    objs = build_parts(parts, coll)
    L = data.get('lighting', {})
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = False; sc.cycles.filter_width = 1.6
    sc.render.resolution_x = width; sc.render.resolution_y = int(width * 9 / 16)
    world = bpy.data.worlds.new('Sky'); sc.world = world; world.use_nodes = True
    nt = world.node_tree; bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA' if hasattr(sky, 'sky_type') else sky.sky_type
    t = float(L.get('ClockTime', 14)); elev = math.sin((t - 6) / 12 * math.pi)
    try:
        sky.sun_elevation = max(-0.05, elev * 1.1); sky.sun_rotation = math.radians(35); sky.altitude = 200; sky.air_density = 1.0 + float(L.get('Haze', 0.6)) * 0.4
    except Exception:
        pass
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.35 if elev > 0 else 0.05
    bpy.ops.object.light_add(type='SUN'); sun = bpy.context.object; sun.data.energy = 4.5 * max(0.15, elev); sun.data.angle = math.radians(2)
    sun.rotation_euler = Euler((math.radians(90 - max(5, elev * 70)), 0, math.radians(35)))
    if 'gameplay' in data:
        g = data['gameplay']; mn, mx = Vector((g[0], -g[3], 0)), Vector((g[2], -g[1], 30))
    else:
        mn, mx = bounds(objs)
    c = (mn + mx) / 2; r = max((mx - mn).length / 2, 20)
    bpy.ops.object.camera_add(location=(c.x - r * 0.9, c.y - r * 1.3, c.z + r * 0.75))
    cam = bpy.context.object; sc.camera = cam; d = c - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 32; cam.data.clip_end = 6000
    sc.use_nodes = True; ct = sc.node_tree
    for n in list(ct.nodes):
        ct.nodes.remove(n)
    rl = ct.nodes.new('CompositorNodeRLayers'); gl = ct.nodes.new('CompositorNodeGlare'); comp = ct.nodes.new('CompositorNodeComposite')
    gl.glare_type = 'FOG_GLOW'; gl.threshold = 1.0; gl.size = 7
    ct.links.new(rl.outputs['Image'], gl.inputs['Image']); ct.links.new(gl.outputs['Image'], comp.inputs['Image'])
    os.makedirs(out, exist_ok=True)
    sc.render.filepath = os.path.join(out, 'cover.png'); bpy.ops.render.render(write_still=True)
    sc.render.resolution_x = sc.render.resolution_y = 512; cam.data.lens = 26
    sc.render.filepath = os.path.join(out, 'icon.png'); bpy.ops.render.render(write_still=True)
    report = {'parts': len(parts), 'cover': 'cover.png', 'icon': 'icon.png'}
    json.dump(report, open(os.path.join(out, 'report.json'), 'w')); print('FORGE', json.dumps(report))


ROBLOX_TRI_LIMIT = 20000  # per MeshPart


def asset_qa(objs, fix=True):
    """Game-asset QA gate (blender-asset-qa / blender-game-optimization skills): merge duplicate
    vertices, drop loose and degenerate geometry, make normals point outwards, then report what is
    left that a human should look at (open edges, floating parts, meshes over Roblox's limit)."""
    report = {'meshes': 0, 'triangles': 0, 'merged': 0, 'loose': 0, 'nonManifoldEdges': 0, 'islands': 0, 'overLimit': [], 'fixed': fix}
    for o in objs:
        if o.type != 'MESH':
            continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        if fix:
            n0 = len(bm.verts)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            report['merged'] += n0 - len(bm.verts)
            bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges)
            loose = [v for v in bm.verts if not v.link_faces]
            report['loose'] += len(loose)
            if loose:
                bmesh.ops.delete(bm, geom=loose, context='VERTS')
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        report['nonManifoldEdges'] += sum(1 for e in bm.edges if not e.is_manifold)
        # floating parts = connected face islands
        seen, islands = set(), 0
        for f in bm.faces:
            if f.index in seen:
                continue
            islands += 1; stack = [f]
            while stack:
                g = stack.pop()
                if g.index in seen:
                    continue
                seen.add(g.index)
                for e in g.edges:
                    for h in e.link_faces:
                        if h.index not in seen:
                            stack.append(h)
        report['islands'] += islands
        tris = sum(len(f.verts) - 2 for f in bm.faces)
        report['triangles'] += tris; report['meshes'] += 1
        if tris > ROBLOX_TRI_LIMIT:
            report['overLimit'].append({'mesh': o.name, 'triangles': tris})
        if fix:
            bm.to_mesh(o.data); o.data.update()
        bm.free()
    return report


def cmd_import(src, out, hd, render, samples):
    """A .glb made elsewhere (Meshy free plan, Sketchfab, Blender): turned to face like a Roblox pet,
    3.4 studs tall, one mesh under Roblox's 20 000 triangle limit, textures embedded in the .fbx."""
    job = json.load(open(src))
    glb = os.path.join(os.path.dirname(os.path.abspath(src)), os.path.basename(job['file']))
    name = re.sub(r'[^\w]', '', job.get('name') or 'Import') or 'Import'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not objs:
        raise SystemExit('no mesh in ' + glb)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # glTF front (+Z) arrives as Blender -Y; Roblox pets look the other way: turn 180°, size, sit on the ground
    mn, mx = bounds([o]); h = max(mx.z - mn.z, 1e-6)
    k = 3.4 / h
    o.rotation_euler = (0, 0, math.pi); o.scale = (k, k, k)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mn, mx = bounds([o]); o.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    tris = tri_count(o)
    if tris > 19000:
        d = o.modifiers.new('Decimate', 'DECIMATE'); d.ratio = 19000 / tris
        bpy.ops.object.modifier_apply(modifier='Decimate')
    bpy.ops.object.shade_smooth()
    os.makedirs(out, exist_ok=True)
    qa = asset_qa([o])
    report = {'name': name, 'trianglesIn': tris, 'triangles': tri_count(o), 'qa': qa}
    if hd:
        bpy.ops.export_scene.fbx(filepath=os.path.join(out, name + '.fbx'), use_selection=True, apply_unit_scale=True, axis_forward='-Z', axis_up='Y',
                                 bake_space_transform=True, path_mode='COPY', embed_textures=True)
        report['export'] = [name + '.fbx']
    if render:
        mn, mx = bounds([o]); c = (mn + mx) / 2; r = max((mx - mn).length / 2, 0.5)
        bpy.context.scene['forge_side'] = 1
        studio(tuple(c), r, '#4f8fff', render, samples)
        bpy.context.scene.render.filepath = os.path.join(out, name + ('_hd' if hd else '') + '.png')
        bpy.ops.render.render(write_still=True)
        report['render'] = os.path.basename(bpy.context.scene.render.filepath)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False)
    print('FORGE', json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) < 3:
        print(__doc__); sys.exit(1)
    cmd, src, out, rest = argv[0], argv[1], argv[2], argv[3:]
    opt = lambda k, d: type(d)(rest[rest.index(k) + 1]) if k in rest else d
    if cmd == 'pet':
        cmd_pet(src, out, '--hd' in rest, opt('--render', 0), opt('--samples', 96))
    elif cmd == 'import':
        cmd_import(src, out, '--hd' in rest, opt('--render', 1024), opt('--samples', 64))
    elif cmd == 'map':
        cmd_map(src, out, opt('--render', 1280), opt('--samples', 64))
    else:
        print(__doc__); sys.exit(1)
