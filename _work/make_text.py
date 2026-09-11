"""Render all text overlay PNGs (1920x1080, transparent) + closing card."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1920, 1080
FDIR = "_work/fonts"
FS = f"{FDIR}/Poppins-SemiBold.ttf"
FM = f"{FDIR}/Poppins-Medium.ttf"
FR = f"{FDIR}/Poppins-Regular.ttf"

def font(p, s): return ImageFont.truetype(p, s)

def draw_shadow_text(img, xy, text, fnt, fill=(255,255,255,255),
                     shadow=(0,0,0,77), off=(0,3), anchor="la"):
    d = ImageDraw.Draw(img)
    x, y = xy
    sh = Image.new("RGBA", img.size, (0,0,0,0))
    ds = ImageDraw.Draw(sh)
    ds.text((x+off[0], y+off[1]), text, font=fnt, fill=shadow, anchor=anchor)
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(sh)
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor)
    return img

def tracked_text(img, cx, y, text, fnt, track=6, fill=(255,255,255,255)):
    d = ImageDraw.Draw(img)
    widths = [d.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + track*(len(text)-1)
    x = cx - total/2
    for ch, w_ in zip(text, widths):
        draw_shadow_text(img, (x, y), ch, fnt, fill=fill, anchor="la")
        x += w_ + track

def paste_emoji(img, path, x, y, size):
    em = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)
    img.alpha_composite(em, (int(x), int(y)))

title = Image.new("RGBA", (W,H), (0,0,0,0))
t1, t1f = "Student Council Elections 2026", font(FS, 78)
d = ImageDraw.Draw(title)
tw = d.textlength(t1, font=t1f)
es, gap = 62, 18
sx = (W-(tw+gap+es))/2
ty = 700
draw_shadow_text(title, (sx, ty), t1, t1f, anchor="la")
paste_emoji(title, "_work/emoji/1f5f3.png", sx+tw+gap, ty+12, es)
tracked_text(title, W/2, ty+108, "THE CITY SCHOOL", font(FM, 46), track=8)
title.save("_work/ov_title.png")

vote = Image.new("RGBA", (W,H), (0,0,0,0))
draw_shadow_text(vote, (W/2, 640), "Every voice. Every vote.", font(FS, 58), anchor="ma")
vote.save("_work/ov_vote.png")

def lower_third(name, role, out):
    lt = Image.new("RGBA", (W,H), (0,0,0,0))
    d = ImageDraw.Draw(lt)
    fn, fr = font(FS, 44), font(FR, 36)
    nw, rw = d.textlength(name, font=fn), d.textlength(role, font=fr)
    pad_x, pad_y, gapx = 34, 20, 22
    bw, bh = int(pad_x*2 + nw + gapx + rw), 96
    bx, by = 72, H - 108 - bh
    bar = Image.new("RGBA", (bw, bh), (0,0,0,0))
    ImageDraw.Draw(bar).rounded_rectangle([0,0,bw-1,bh-1], radius=14, fill=(0,0,0,150))
    lt.alpha_composite(bar, (bx, by))
    draw_shadow_text(lt, (bx+pad_x, by+14), name, fn, anchor="la")
    draw_shadow_text(lt, (bx+pad_x+nw+gapx, by+22), role, fr,
                     fill=(235,235,235,255), anchor="la")
    lt.save(out)

lower_third("Ms. Nelum", "Vice Principal", "_work/ov_lt1.png")
lower_third("Ms. Masooma", "Senior Mistress", "_work/ov_lt2.png")
lower_third("Ms. Mariyam", "Teacher", "_work/ov_lt3.png")

MAROON = (92, 16, 31, 255)
card = Image.new("RGBA", (W,H), MAROON)
draw_shadow_text(card, (W/2, 400), "Thank you to every candidate, teacher, and voter.",
                 font(FS, 54), anchor="ma")
l2, l2f = "Results coming soon", font(FS, 56)
d = ImageDraw.Draw(card)
lw = d.textlength(l2, font=l2f)
es2, gap2 = 56, 16
sx2 = (W-(lw+gap2+es2))/2
draw_shadow_text(card, (sx2, 500), l2, l2f, anchor="la")
paste_emoji(card, "_work/emoji/1f440.png", sx2+lw+gap2, 512, es2)
tracked_text(card, W/2, 640, "THE CITY SCHOOL \u00b7 2026", font(FM, 44), track=6)
card.save("_work/card.png")
print("text assets done")
