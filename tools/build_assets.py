"""Pack third-party pixel art into the strips the game loads.

Usage: python3 -I tools/build_assets.py <packs-dir>

<packs-dir> must hold the unzipped downloads listed in assets/CREDITS.md.
Each animation is cut into frames, aligned on the character's feet and
written as one horizontal strip with the feet at the bottom centre of
every cell. js/config/spriteMeta.js is regenerated with frame sizes.
"""
import json
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'gv')

HERO = ' gothicvania patreon collection/Gothic-hero-Files/PNG'
HERO2 = ' gothicvania patreon collection/Gothic-hero-p2-Files/PNG/sprites'
CEM = 'gothicvania-cemetery-files/PNG/Sprites'
PATREON = ' gothicvania patreon collection'
CLIFFS = 'Magic-Cliffs-Environment/PNG'
SWAMP = 'Gothicvania Swamp files'
TOWN = 'GothicVania-town-files'
TOWN_ENV = TOWN + '/PNG/environment'
CHURCH = 'gothicvania church files'
OLD_CASTLE = 'Old-dark-Castle-tileset-Files/PNG'
GOTHIC_CASTLE = 'Gothic-Castle-Files/PNG/layers'
DEMON = 'demon-Files/PNG'
HOUND = 'Hell-Hound-Files/PNG'
SKULL = 'Fire-Skull-Files/PNG'
BEAST = 'Hell-Beast-Files/PNG'

# castle/tileset.png: the old dark castle tileset at the top, then (CS_ROW rows down) floor, body and
# ledge strips re-cut so their art starts at the top of the tile, then the castle's two backdrop
# pictures (props are cut from them). js/domain/levels.js STAMPS and renderStage.js read these positions.
CS_ROW = 15
CS_PICS_Y = 368  # old castle backdrop picture (960x304); the gothic castle picture follows it
CS_PICS2_Y = CS_PICS_Y + 304

# Where the town props and the church tileset sit inside assets/gv/town/tileset.png
# (the town tileset is at the top left). STAMPS in js/domain/levels.js and
# renderStage.js read these positions: church tiles are CH_ROW rows down.
CH_ROW = 12
PROPS_Y = 416
PROP_SLOTS = [  # (file, x, y) in the combined tileset
    ('street-lamp', 0, PROPS_Y), ('crate-stack', 40, PROPS_Y), ('wagon', 120, PROPS_Y),
    ('well', 220, PROPS_Y), ('barrel', 292, PROPS_Y), ('crate', 322, PROPS_Y), ('sign', 368, PROPS_Y),
    ('house-a', 0, PROPS_Y + 112), ('house-b', 176, PROPS_Y + 112), ('house-c', 394, PROPS_Y + 112),
]


def sheet(path, n):
    img = Image.open(path).convert('RGBA')
    fw = img.width // n
    return [img.crop((i * fw, 0, (i + 1) * fw, img.height)) for i in range(n)]


def folder(path):
    names = sorted(f for f in os.listdir(path) if f.endswith('.png'))
    names.sort(key=lambda f: int(''.join(c for c in f.rsplit('_', 1)[-1] if c.isdigit()) or 0)
               if '_' in f else int(''.join(c for c in f if c.isdigit()) or 0))
    return [Image.open(os.path.join(path, f)).convert('RGBA') for f in names]


def feet_anchor(frames, anchor_frame=0):
    """x = centre of the lowest opaque rows of one frame; y = lowest opaque row of any frame."""
    bottom = max(f.getbbox()[3] for f in frames if f.getbbox())
    ref = frames[anchor_frame]
    a = ref.getchannel('A')
    rb = ref.getbbox()[3]
    xs = [x for y in range(max(0, rb - 6), rb) for x in range(ref.width) if a.getpixel((x, y)) > 0]
    xs.sort()
    return xs[len(xs) // 2], bottom


def drop_to_floor(frames):
    """Airborne sheets move the hero up inside the frame; pin each frame's lowest pixel to the floor."""
    h = max(f.height for f in frames)
    out = []
    for f in frames:
        bb = f.getbbox()
        g = Image.new('RGBA', (f.width, h))
        g.alpha_composite(f, (0, h - bb[3]))
        out.append(g)
    return out


def pack(name, frames, fps, anchor_frame=0, anchor_x=None, pad=1):
    ax, ay = feet_anchor(frames, anchor_frame)
    if anchor_x is not None:
        ax = anchor_x
    left = right = top = 0
    for f in frames:
        bb = f.getbbox()
        if not bb:
            continue
        left = max(left, ax - bb[0])
        right = max(right, bb[2] - ax)
        top = max(top, ay - bb[1])
    half = max(left, right) + pad
    cw, ch = half * 2, top + pad
    strip = Image.new('RGBA', (cw * len(frames), ch))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * cw + half - ax, ch - ay), (0, 0))
    dst = os.path.join(OUT, name + '.png')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    strip.save(dst, optimize=True)
    return {'src': 'assets/gv/' + name + '.png', 'fw': cw, 'fh': ch, 'frames': len(frames), 'fps': fps}


def portrait(frame, dst, size=96):
    """Head-and-shoulders crop of the hero, scaled up without smoothing."""
    bb = frame.getbbox()
    crop = frame.crop((bb[0], bb[1], bb[2], bb[1] + 24))
    k = size // max(crop.size)
    big = crop.resize((crop.width * k, crop.height * k), Image.NEAREST)
    out = Image.new('RGBA', (size, size))
    out.alpha_composite(big, ((size - big.width) // 2, (size - big.height) // 2))
    out.save(dst, optimize=True)


def town_assets(gv, meta):
    """Town + church tileset with the town props (one image, so a stage has one tileset), and the backdrops."""
    out = os.path.join(OUT, 'town')
    os.makedirs(out, exist_ok=True)
    env = gv(TOWN_ENV)
    town = Image.open(os.path.join(env, 'layers', 'tileset.png')).convert('RGBA')
    church = Image.open(gv(CHURCH, 'ENVIRONMENT', 'tileset.png')).convert('RGBA')
    assert town.height == CH_ROW * 16
    sheet = Image.new('RGBA', (640, PROPS_Y + 112 + 244))
    sheet.alpha_composite(town, (0, 0))
    sheet.alpha_composite(church, (0, CH_ROW * 16))
    for name, x, y in PROP_SLOTS:
        sheet.alpha_composite(Image.open(os.path.join(env, 'props-sliced', name + '.png')).convert('RGBA'), (x, y))
    sheet.save(os.path.join(out, 'tileset.png'), optimize=True)
    meta['town/tileset'] = {'src': 'assets/gv/town/tileset.png'}
    for f in ('background.png', 'middleground.png'):
        shutil.copy(os.path.join(env, 'layers', f), os.path.join(out, f))
        meta['town/' + f[:-4]] = {'src': 'assets/gv/town/' + f}
    # Church backdrop: the pack's five wall panels (window, column, altar, gargoyle, torch) joined
    # into one strip that repeats sideways; the magenta gaps between them are dropped.
    bg = Image.open(gv(CHURCH, 'ENVIRONMENT', 'backgrounds.png')).convert('RGBA')
    keep = [x for x in range(bg.width) if any(bg.getpixel((x, y))[3] > 0 for y in range(bg.height))]
    strip = Image.new('RGBA', (len(keep), bg.height))
    for i, x in enumerate(keep):
        strip.alpha_composite(bg.crop((x, 0, x + 1, bg.height)), (i, 0))
    strip.save(os.path.join(out, 'church-backdrop.png'), optimize=True)
    meta['town/church-backdrop'] = {'src': 'assets/gv/town/church-backdrop.png'}


def clear_colour(img, rgb):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y][:3] == rgb:
                px[x, y] = (0, 0, 0, 0)
    return out


def castle_assets(gv, meta):
    """Castle tileset + props sheet and the repeating hall backdrop."""
    out = os.path.join(OUT, 'castle')
    os.makedirs(out, exist_ok=True)
    old = gv('gv-patreon', PATREON, OLD_CASTLE)
    gothic = gv('gv-patreon', PATREON, GOTHIC_CASTLE)
    tiles = Image.open(os.path.join(old, 'old-dark-castle-interior-tileset.png')).convert('RGBA')
    pic = Image.open(os.path.join(old, 'old-dark-castle-interior-background.png')).convert('RGBA')
    hall = Image.open(os.path.join(gothic, 'gothic-castle-background.png')).convert('RGBA')
    assert tiles.size == (832, 240) and pic.size == (960, 304)
    sheet = Image.new('RGBA', (960, CS_PICS2_Y + hall.height))
    sheet.alpha_composite(tiles, (0, 0))
    y0 = CS_ROW * 16
    # (source x, source y) of each 32x16 strip: floor top, floor body, one-way ledge
    for i, (sx, sy) in enumerate([(26 * 16, 154), (26 * 16, 170), (29 * 16, 154)]):
        sheet.alpha_composite(tiles.crop((sx, sy, sx + 32, sy + 16)), (0, y0 + i * 16))
    # Both pictures have a solid ground colour; make it clear so props cut from them sit on the stage.
    pic = clear_colour(pic, (15, 34, 41))
    hall_clear = clear_colour(hall, (7, 7, 7))
    sheet.alpha_composite(pic, (0, CS_PICS_Y))
    sheet.alpha_composite(hall_clear, (0, CS_PICS2_Y))
    sheet.save(os.path.join(out, 'tileset.png'), optimize=True)
    meta['castle/tileset'] = {'src': 'assets/gv/castle/tileset.png'}
    # Backdrop: the hall pack's four wall panels (staircase, window, gargoyle, torches) joined into one
    # strip that repeats sideways; the magenta gaps between them are dropped.
    keep = [x for x in range(hall.width) if any(hall.getpixel((x, y))[3] > 0 for y in range(160))]
    strip = Image.new('RGBA', (len(keep), 160))
    for i, x in enumerate(keep):
        strip.alpha_composite(hall.crop((x, 0, x + 1, 160)), (i, 0))
    strip.save(os.path.join(out, 'backdrop.png'), optimize=True)
    meta['castle/backdrop'] = {'src': 'assets/gv/castle/backdrop.png'}


def warden_assets(gv, meta):
    """The Iron Warden: the pack's demon. Idle/walk, wind-up (crouch, then rear up) and the breath slam."""
    d = gv('gv-patreon', PATREON, DEMON)
    idle = sheet(os.path.join(d, 'demon-idle.png'), 6)
    plain = sheet(os.path.join(d, 'demon-attack-no-breath.png'), 8)
    breath = sheet(os.path.join(d, 'demon-attack.png'), 11)
    # Each sheet is lined up on its own standing frame's feet (the sheets' cells differ in size),
    # so the three states stand in the same spot when swapped.
    meta['enemy/warden'] = pack('enemy/warden', idle, 6)
    meta['enemy/warden_windup'] = pack('enemy/warden_windup', [plain[i] for i in (0, 1, 2, 6, 7)], 8,
                                       anchor_x=feet_anchor(plain)[0])
    meta['enemy/warden_slam'] = pack('enemy/warden_slam', breath[6:], 12, anchor_x=feet_anchor(breath)[0])


def mid_x(frames):
    """Centre of the frames' bodies, so every state of a long animal stands on the same spot."""
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    return round(sum((b[0] + b[2]) / 2 for b in boxes) / len(boxes))


def monster_assets(gv, meta):
    """Swamp spider and bog thing, the church's burning ghoul, and the patreon pack's hell hound."""
    meta['enemy/spider'] = pack('enemy/spider', folder(gv(SWAMP, 'Sprites', 'Spider', 'walk')), 10)
    meta['enemy/thing'] = pack('enemy/thing', folder(gv(SWAMP, 'Sprites', 'Thing', 'walk thing')), 6)
    meta['enemy/ghoul'] = pack('enemy/ghoul', folder(gv(CHURCH, 'SPRITES', 'burning-ghoul', 'sprites', 'v1')), 10)
    h = gv('gv-patreon', PATREON, HOUND)
    # (name, file, frames in the sheet, fps); the jump sheet is dropped to the floor like the hero's.
    for name, n, fps in (('idle', 6, 6), ('walk', 12, 14), ('run', 5, 14), ('jump', 6, 10)):
        frames = sheet(os.path.join(h, 'hell-hound-%s.png' % name), n)
        if name == 'jump':
            frames = drop_to_floor(frames)
        key = 'enemy/hound' + ('' if name == 'walk' else '_' + name)
        meta[key] = pack(key, frames, fps, anchor_x=mid_x(frames))


def caster_assets(gv, meta):
    """The church's wizard (idle, and the ten-frame cast), the patreon fire skull and the fireball."""
    w = gv(CHURCH, 'SPRITES', 'wizard')
    idle = folder(os.path.join(w, 'idle-sprites'))
    cast = folder(os.path.join(w, 'fire-sprites'))
    # Both strips stand on the same feet (frame 0 of the cast is the idle pose).
    meta['enemy/wizard'] = pack('enemy/wizard', idle, 6)
    meta['enemy/wizard_cast'] = pack('enemy/wizard_cast', cast, 10)
    s = gv('gv-patreon', PATREON, SKULL)
    flame = sheet(os.path.join(s, 'fire-skull.png'), 8)
    plain = sheet(os.path.join(s, 'fire-skull-no-fire.png'), 4)
    # The flaming skull is a big cloud and the plain one is just the skull, so line the two up on the
    # skull's centre (not the feet): pad the plain frames to the flame frame's size, skull in the middle.
    fh = flame[0].height
    padded = []
    for f in plain:
        g = Image.new('RGBA', (f.width, fh))
        g.alpha_composite(f, (0, (fh - f.height) // 2))
        padded.append(g)
    meta['enemy/fire_skull'] = pack('enemy/fire_skull', flame, 12, anchor_x=mid_x(flame))
    meta['enemy/fire_skull_calm'] = pack('enemy/fire_skull_calm', padded, 8, anchor_x=mid_x(padded))
    ball = sheet(os.path.join(gv('gv-patreon', PATREON, BEAST), 'fire-ball.png'), 3)
    meta['fx/fireball'] = pack('fx/fireball', ball, 12, anchor_x=mid_x(ball))


def main(packs):
    gv = lambda *p: os.path.join(packs, *p)
    hero = gv('gv-patreon', HERO)
    hero2 = gv('gv-patreon', HERO2)
    cem = gv('gothicvania-cemetery-files_1', CEM)
    meta = {}

    idle = sheet(os.path.join(hero, 'gothic-hero-idle.png'), 4)
    run = sheet(os.path.join(hero, 'gothic-hero-run.png'), 12)
    atk = sheet(os.path.join(hero, 'gothic-hero-attack.png'), 6)
    jump = sheet(os.path.join(hero, 'gothic-hero-jump.png'), 5)
    meta['hero/idle'] = pack('hero/idle', idle, 6)
    meta['hero/run'] = pack('hero/run', run, 16)
    meta['hero/attack'] = pack('hero/attack', atk, 18)
    meta['hero/jump'] = pack('hero/jump', drop_to_floor(jump), 8)
    meta['hero/crouch'] = pack('hero/crouch', folder(os.path.join(hero2, 'crouch')), 10)
    meta['hero/crouch_slash'] = pack('hero/crouch_slash', folder(os.path.join(hero2, 'crouch-slash')), 16)
    meta['hero/hurt'] = pack('hero/hurt', folder(os.path.join(hero2, 'hurt')), 10)
    meta['hero/jump_attack'] = pack('hero/jump_attack', drop_to_floor(folder(os.path.join(hero2, 'jump-attack'))), 18)

    portrait(idle[0], os.path.join(OUT, 'hero', 'portrait.png'))
    meta['hero/portrait'] = {'src': 'assets/gv/hero/portrait.png'}

    meta['enemy/skeleton'] = pack('enemy/skeleton', folder(os.path.join(cem, 'skeleton')), 10)
    meta['enemy/skeleton_clothed'] = pack('enemy/skeleton_clothed', folder(os.path.join(cem, 'skeleton-clothed')), 9)
    meta['enemy/skeleton_rise'] = pack('enemy/skeleton_rise', folder(os.path.join(cem, 'skeleton-rise')), 10)
    meta['enemy/ghost'] = pack('enemy/ghost', folder(os.path.join(cem, 'ghost')), 8)
    meta['fx/death'] = pack('fx/death', folder(os.path.join(cem, 'enemy-death')), 14)
    wolf = gv('gv-patreon', PATREON, 'wolf-runing-cycle/sprites/wolf-runing-cycle-skin.png')
    meta['enemy/wolf'] = pack('enemy/wolf', sheet(wolf, 4), 12)

    os.makedirs(os.path.join(OUT, 'cliffs'), exist_ok=True)
    for f in ('tileset.png', 'sky.png', 'clouds.png', 'far-grounds.png', 'sea.png'):
        shutil.copy(gv('Magic-Cliffs-Environment', CLIFFS, f), os.path.join(OUT, 'cliffs', f))
        meta['cliffs/' + f[:-4]] = {'src': 'assets/gv/cliffs/' + f}

    os.makedirs(os.path.join(OUT, 'swamp'), exist_ok=True)
    for f in ('tileset.png', 'background.png', 'mid-layer-01.png', 'mid-layer-02.png'):
        shutil.copy(gv(SWAMP, 'Evironment', f), os.path.join(OUT, 'swamp', f))  # (sic) the pack's folder name
        meta['swamp/' + f[:-4]] = {'src': 'assets/gv/swamp/' + f}

    town_assets(gv, meta)
    castle_assets(gv, meta)
    warden_assets(gv, meta)
    monster_assets(gv, meta)
    caster_assets(gv, meta)

    lic = os.path.join(OUT, 'licenses')
    os.makedirs(lic, exist_ok=True)
    shutil.copy(gv('gv-patreon', PATREON, 'public-license.txt'), os.path.join(lic, 'gothicvania-patreon-collection.txt'))
    shutil.copy(gv('gothicvania-cemetery-files_1', 'gothicvania-cemetery-files', 'public-license.txt'),
                os.path.join(lic, 'gothicvania-cemetery.txt'))
    shutil.copy(gv('Magic-Cliffs-Environment', 'Magic-Cliffs-Environment', 'public-license.txt'),
                os.path.join(lic, 'magic-cliffs-environment.txt'))
    shutil.copy(gv(SWAMP, 'public-license.txt'), os.path.join(lic, 'gothicvania-swamp.txt'))
    shutil.copy(gv(TOWN, 'public-license.txt'), os.path.join(lic, 'gothicvania-town.txt'))
    shutil.copy(gv(CHURCH, 'public-license.txt'), os.path.join(lic, 'gothicvania-church.txt'))

    body = json.dumps(meta, indent=2, sort_keys=True)
    with open(os.path.join(ROOT, 'js', 'config', 'spriteMeta.js'), 'w') as fh:
        fh.write('/** Generated by tools/build_assets.py — do not edit by hand. */\n')
        fh.write('export const SPRITE_META = ' + body + ';\n')
    for k, v in sorted(meta.items()):
        if 'fw' in v:
            print(k, v['fw'], v['fh'], v['frames'])


if __name__ == '__main__':
    main(sys.argv[1])
