"""Rebuild the leaderboard slide of the intro video (site/blog/efe-intro.mp4, frames 409-483, 13.6-16.1 s).

The video has no editable source project: it was delivered as a finished mp4, and each number update replaces the
slide's frames in that mp4. This script re-renders the rows region (y >= 245) of every slide frame from HTML with
Inter 3.19 (the video's font), on the slide's background, and keeps the header (title and subtitle, y < 245) from the
current frames. Timing (row fade-in, bar growth, count-up) is the slide's own, fitted in the 10-27 update.

  python3 lb9.py validate   # render ROWS and compare with the current frames (equal rows: a few levels of difference)
  python3 lb9.py new        # write the new frames to new/NNNN.png (409-483)

Inputs: cur/NNNN.png (frames of the current mp4, numbered by frame index), fonts/roman319.woff2.
"""
import io, math, os, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = f'file://{HERE}/fonts/roman319.woff2'
BG = np.array([4, 6, 3.])
TRACK = 'rgb(29,31,28)'

# slide timing (frame numbers), from the 10-27 fit
ROW_S, ROW_DL, ROW_D = 411.76, 1.8, 15.13
BAR_S, BAR_DL, BAR_D = 417.75, 1.8, 30.0
HEAD_Y = 245            # rows region starts here; above it the header is kept from the current frames
FIRST, LAST_ANIM, LAST = 409, 476, 483   # 477-483 fade out with the header


def e3(t): t = min(max(t, 0), 1); return 1 - (1 - t) ** 3
def expo(t): t = min(max(t, 0), 1); return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


class R:
    def __init__(self):
        self.p = sync_playwright().start()
        self.b = self.p.chromium.launch(args=['--force-color-profile=srgb'])
        self.pg = self.b.new_page(viewport={'width': 1920, 'height': 1080})
        self.path = f'{HERE}/_page{os.getpid()}.html'
    def shot(self, body):
        css = (f"@font-face{{font-family:'F3';src:url('{FONT}');font-weight:100 900;}}"
               "html,body{margin:0;padding:0;background:rgb(4,6,3);width:1920px;height:1080px;overflow:hidden;}"
               "body{font-family:'F3';color:#fff;-webkit-font-smoothing:antialiased;}")
        open(self.path, 'w').write(f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{body}</body></html>")
        self.pg.goto(f'file://{self.path}')
        self.pg.evaluate("document.fonts.ready.then(()=>1)")
        assert 'loaded' in self.pg.evaluate("[...document.fonts].map(f=>f.status).join(',')")
        self.pg.wait_for_timeout(30)
        return np.asarray(Image.open(io.BytesIO(self.pg.screenshot())).convert('RGB')).astype(float)
    def close(self):
        self.b.close(); self.p.stop(); os.path.exists(self.path) and os.remove(self.path)


def rows_html(rows, n, top, pitch, bar_h, name_px, pct_px):
    els = []
    for k, row in enumerate(rows):
        y = top + pitch * k
        op = e3((n - ROW_S - ROW_DL * k) / ROW_D)
        e = expo((n - BAR_S - BAR_DL * k) / BAR_D)
        frac = row['s'] / row['t']
        w = math.ceil(900 * frac * e - 1e-9) if e > 0 else 0
        pct = round(100 * frac * e)
        els.append(f'<div style="position:absolute;left:430px;top:{y}px;width:900px;height:{bar_h}px;background:{TRACK}"></div>')
        if w > 0:
            els.append(f'<div style="position:absolute;left:430px;top:{y}px;width:{w}px;height:{bar_h}px;background:{row["col"]}"></div>')
        if op > 0:
            ty = y + (bar_h - 31) / 2 - 4
            els.append(f'<div style="position:absolute;left:{430 + w + 17.5}px;top:{ty}px;font-family:F3;font-size:{pct_px}px;font-weight:700;'
                       f'letter-spacing:-0.03em;line-height:1;white-space:pre;color:rgb(251,253,250);opacity:{op}">{pct}%</div>')
            els.append(f'<div style="position:absolute;left:52px;top:{ty + (pct_px - name_px) / 2}px;font-family:F3;font-size:{name_px}px;font-weight:650;'
                       f'letter-spacing:-0.03em;line-height:1;white-space:pre;color:rgb(250,252,249);opacity:{op}">{row["name"]}</div>')
    return ''.join(els)


def cur(n):
    return np.asarray(Image.open(f'{HERE}/cur/{n:04d}.png').convert('RGB')).astype(float)


def compose(r, n, rows, **lay):
    img = r.shot(rows_html(rows, n, **lay))
    img[:HEAD_Y] = cur(n)[:HEAD_Y]
    return img


LAYOUT = dict(top=262, pitch=80, bar_h=30, name_px=33, pct_px=35)   # 9 rows: the last bar ends at y = 902
# the site's Standard view (common9, 456 core Standard tests); the site's agent colours: the three strongest have their own,
# the others the site's grey
GREY = 'rgb(150,156,163)'
ROWS = [dict(name='Claude Fable 5.2', s=226, t=456, col='#7d1d3f'), dict(name='GPT-6 Astra', s=157, t=456, col='#3a5fc8'),
            dict(name='Claude Opus 5.5', s=114, t=456, col='#b83f8c'), dict(name='Gemini 4 Argon', s=110, t=456, col=GREY),
            dict(name='Kimi 3.1 Pro', s=46, t=456, col=GREY), dict(name='Gemini 3.8 Flash', s=29, t=456, col=GREY),
            dict(name='Qwen3.8 Max', s=17, t=456, col=GREY), dict(name='DeepSeek V4.1 Flash', s=14, t=456, col=GREY),
            dict(name='GLM 5.3 Flash', s=11, t=456, col=GREY)]

if __name__ == '__main__':
    mode = sys.argv[1]
    os.makedirs(f'{HERE}/new', exist_ok=True); os.makedirs(f'{HERE}/sheets', exist_ok=True)
    r = R()
    if mode == 'validate':
        for n in (412, 418, 425, 432, 446, 460, 476):
            img = compose(r, n, ROWS, **LAYOUT); o = cur(n)
            d = np.abs(img - o)[HEAD_Y:].mean()
            print(n, 'mean abs diff, rows region', round(d, 3))
            if n in (425, 460):
                Image.fromarray(np.concatenate([o[HEAD_Y:900], img[HEAD_Y:900]], 0).clip(0, 255).astype(np.uint8)).save(f'{HERE}/sheets/val_{n}.png')
    if mode == 'new':
        for n in range(FIRST, LAST_ANIM + 1):
            img = compose(r, n, ROWS, **LAYOUT)
            Image.fromarray(np.clip(np.round(img), 0, 255).astype(np.uint8)).save(f'{HERE}/new/{n:04d}.png')
        # fade-out: each current fade frame is the current last frame times k (plus the next scene); add k times the change
        o_last = cur(LAST_ANIM); n_last = np.asarray(Image.open(f'{HERE}/new/{LAST_ANIM:04d}.png')).astype(float)
        for n in range(LAST_ANIM + 1, LAST + 1):
            o = cur(n); k = (o * o_last).sum() / (o_last * o_last).sum()
            Image.fromarray(np.clip(np.round(o + k * (n_last - o_last)), 0, 255).astype(np.uint8)).save(f'{HERE}/new/{n:04d}.png')
            print(n, 'fade k', round(k, 4))
    r.close()
