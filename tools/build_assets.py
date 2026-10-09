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

    lic = os.path.join(OUT, 'licenses')
    os.makedirs(lic, exist_ok=True)
    shutil.copy(gv('gv-patreon', PATREON, 'public-license.txt'), os.path.join(lic, 'gothicvania-patreon-collection.txt'))
    shutil.copy(gv('gothicvania-cemetery-files_1', 'gothicvania-cemetery-files', 'public-license.txt'),
                os.path.join(lic, 'gothicvania-cemetery.txt'))
    shutil.copy(gv('Magic-Cliffs-Environment', 'Magic-Cliffs-Environment', 'public-license.txt'),
                os.path.join(lic, 'magic-cliffs-environment.txt'))

    body = json.dumps(meta, indent=2, sort_keys=True)
    with open(os.path.join(ROOT, 'js', 'config', 'spriteMeta.js'), 'w') as fh:
        fh.write('/** Generated by tools/build_assets.py — do not edit by hand. */\n')
        fh.write('export const SPRITE_META = ' + body + ';\n')
    for k, v in sorted(meta.items()):
        if 'fw' in v:
            print(k, v['fw'], v['fh'], v['frames'])


if __name__ == '__main__':
    main(sys.argv[1])
