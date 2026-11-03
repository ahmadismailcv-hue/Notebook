"""Synthesize the ambient soundtrack: wind (outside / muffled inside), stove crackle, lantern-wick clicks.

Usage: python3 make_audio.py OUT.wav
Timing must match make_video.sh (SHOT, XF, interior flags).
"""
import sys
import wave
import numpy as np

SR = 44100
SHOT, XF = 4.5, 0.7
STEP = SHOT - XF
# 1 = interior, 0 = exterior, per shot 01..12
INTERIOR = [0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0]
LANTERN_SHOT = 9  # zero-based index of shot 10 (wick turned down)
N = len(INTERIOR)
T = N * SHOT - (N - 1) * XF
n = int(T * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(1970)


def lowpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)  # gentle 2nd-order-ish rolloff
    return np.fft.irfft(X, len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / np.sqrt(1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)


# --- interior/exterior blend envelope, following the video crossfades
kt, kv = [0.0], [INTERIOR[0]]
for i in range(1, N):
    kt += [i * STEP, i * STEP + XF]
    kv += [INTERIOR[i - 1], INTERIOR[i]]
inside = np.interp(t, kt, kv)

# --- wind: brown-ish noise with slow gusts, plus a whistling band
white = rng.standard_normal(n)
gust = 0.55 + 0.25 * np.sin(2 * np.pi * 0.07 * t + 1.3) + 0.2 * np.sin(2 * np.pi * 0.19 * t + 0.4)
gust = np.clip(gust, 0.15, 1.0)
wind_body = norm(lowpass(white, 500))
whistle_fc = 700 + 250 * np.sin(2 * np.pi * 0.05 * t)  # applied as fixed band; moving centre via mix
whistle = norm(bandpass(rng.standard_normal(n), 500, 1100)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t))
wind_out = norm(wind_body * gust + 0.25 * whistle * gust)
wind_in = norm(lowpass(wind_out, 220))  # through stone walls
wind = (1 - inside) * 0.55 * wind_out + inside * 0.22 * wind_in

# --- stove: low rumble + crackles (only indoors)
rumble = norm(lowpass(rng.standard_normal(n), 120)) * 0.10
crackle = np.zeros(n)
rate = 7.0  # crackles per second
k = rng.poisson(rate * T)
for pos in rng.uniform(0, T, k):
    i0 = int(pos * SR)
    dur = rng.uniform(0.002, 0.018)
    L = int(dur * SR)
    if i0 + L >= n:
        continue
    amp = rng.uniform(0.15, 1.0) ** 2
    burst = rng.standard_normal(L) * np.exp(-np.linspace(0, 6, L))
    crackle[i0:i0 + L] += amp * burst
crackle = bandpass(crackle, 900, 7000)
crackle = 0.35 * norm(crackle)
# fire a bit quieter after the lantern goes down (room hushes)
hush = np.interp(t, [0, LANTERN_SHOT * STEP + 2.0, LANTERN_SHOT * STEP + 3.5, T], [1, 1, 0.65, 0.65])
stove = (rumble + crackle) * inside * hush

# --- lantern wick: three small metallic ratchet clicks in shot 10
clicks = np.zeros(n)
c0 = LANTERN_SHOT * STEP + 1.4
for j in range(3):
    i0 = int((c0 + j * 0.28) * SR)
    L = int(0.025 * SR)
    tt = np.arange(L) / SR
    clicks[i0:i0 + L] += (np.sin(2 * np.pi * 3200 * tt) + 0.6 * np.sin(2 * np.pi * 5100 * tt)) * np.exp(-tt * 260)
clicks *= 0.18

mix = wind + stove + clicks
# fades
fade_in = np.clip(t / 1.5, 0, 1)
fade_out = np.clip((T - t) / 3.0, 0, 1)
mix *= fade_in * fade_out
mix = 0.8 * mix / np.max(np.abs(mix))

stereo = np.stack([mix, np.roll(mix, int(0.0007 * SR))], axis=1)  # slight width
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {sys.argv[1]} ({T:.1f}s)")
