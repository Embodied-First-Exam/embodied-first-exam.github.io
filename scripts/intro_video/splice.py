"""Splice the re-rendered leaderboard slide (new/0409-0483.png) into the intro video.

Only the GOP that holds the slide is re-encoded (frames 409-494: the slide starts with a cut on the keyframe at 409,
and the next keyframe is 495); frames 0-408 and 495-end are copied bit for bit (stream copy), and so is the audio. Unchanged frames of the
re-encoded span go in as the current decoded YUV; in the slide frames only the rows region (y >= 245) is replaced,
converted with the inverse of the decoder's BT.601 limited-range matrix.

  python3 splice.py IN.mp4 OUT.mp4
"""
import os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
A, B = 409, 495            # re-encoded span [A, B): frame numbers by presentation time, from keyframe to keyframe
KEY = [0]
NEW = range(409, 484)
HEAD_Y = 245
M = np.array([[1.16448, 0.0, 1.59582], [1.16442, -0.39169, -0.81297], [1.16442, 2.01772, 0.0]])
OFF = np.array([-223.8978, 134.07544, -277.88739]); MINV = np.linalg.inv(M); YOFF = 0.3
X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-x264-params', 'qpmax=24', '-pix_fmt', 'yuv420p']


def rgb2yuv(rgb):
    x = rgb.astype(np.float64).reshape(-1, 3) - OFF
    yuv = (x @ MINV.T).reshape(rgb.shape)
    c = lambda a: np.clip(np.round(a), 0, 255).astype(np.uint8)
    return (c(yuv[..., 0] + YOFF), c(yuv[..., 1].reshape(H // 2, 2, W // 2, 2).mean((1, 3))),
            c(yuv[..., 2].reshape(H // 2, 2, W // 2, 2).mean((1, 3))))


def run(*a): subprocess.run(a, check=True)


def main(src, out):
    w = f'{HERE}/work'; os.makedirs(w, exist_ok=True)
    fs = W * H * 3 // 2
    raw = f'{w}/span.yuv'
    run('ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'select=between(n\\,{A}\\,{B - 1})', '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', raw)
    assert os.path.getsize(raw) == fs * (B - A), os.path.getsize(raw)
    mix = f'{w}/mix.yuv'
    with open(raw, 'rb') as f, open(mix, 'wb') as g:
        for n in range(A, B):
            d = np.frombuffer(f.read(fs), np.uint8)
            if n in NEW:
                Y = d[:W * H].reshape(H, W).copy(); U = d[W * H:W * H * 5 // 4].reshape(H // 2, W // 2).copy(); V = d[W * H * 5 // 4:].reshape(H // 2, W // 2).copy()
                y, u, v = rgb2yuv(np.asarray(Image.open(f'{HERE}/new/{n:04d}.png').convert('RGB')))
                Y[HEAD_Y:] = y[HEAD_Y:]; U[HEAD_Y // 2 + 1:] = u[HEAD_Y // 2 + 1:]; V[HEAD_Y // 2 + 1:] = v[HEAD_Y // 2 + 1:]
                d = np.concatenate([Y.ravel(), U.ravel(), V.ravel()])
            g.write(d.tobytes())
    keys = '+'.join(f'eq(n,{k})' for k in KEY)
    run('ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{W}x{H}', '-r', '30', '-i', mix, *X264,
        '-force_key_frames', f'expr:{keys}', '-video_track_timescale', '15360', f'{w}/mid.mp4')
    run('ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:v', '-c', 'copy', '-f', 'segment', '-segment_frames', f'{A},{B}',
        '-reset_timestamps', '1', '-video_track_timescale', '15360', f'{w}/seg%d.mp4')
    open(f'{w}/concat.txt', 'w').write(f"file '{w}/seg0.mp4'\nfile '{w}/mid.mp4'\nfile '{w}/seg2.mp4'\n")
    run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{w}/concat.txt', '-c', 'copy', f'{w}/video.mp4')
    run('ffmpeg', '-v', 'error', '-y', '-i', f'{w}/video.mp4', '-i', src, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-movflags', '+faststart', out)


if __name__ == '__main__':
    main(*sys.argv[1:3])
