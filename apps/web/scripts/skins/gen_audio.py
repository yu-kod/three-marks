"""スキンの効果音と BGM を作る（すべて自作の合成音。外部の素材は使っていない）

  python3 apps/web/scripts/skins/gen_audio.py
"""
import math, random, struct, wave, os, subprocess
SR = 22050
ROOT = os.path.join(os.path.dirname(__file__), "../../public/skins")
random.seed(7)

def env(i, n, a=0.003, r=None):
    t = i / SR; dur = n / SR
    att = min(1, t / a) if a > 0 else 1
    rel = math.exp(-t / r) if r else max(0, 1 - t / dur)
    return att * rel

def tone(freq, dur, kind="sine", decay=None, vol=0.6, f_end=None):
    n = int(SR * dur); out = []; ph = 0
    for i in range(n):
        f = freq if f_end is None else freq + (f_end - freq) * i / n
        ph += 2 * math.pi * f / SR
        if kind == "sine": v = math.sin(ph)
        elif kind == "square": v = 1 if math.sin(ph) >= 0 else -1
        elif kind == "tri": v = 2 / math.pi * math.asin(math.sin(ph))
        elif kind == "saw": v = 2 * ((ph / (2 * math.pi)) % 1) - 1
        out.append(v * vol * env(i, n, r=decay))
    return out

def noise(dur, vol=0.6, decay=0.02, lp=0.3):
    n = int(SR * dur); out = []; y = 0
    for i in range(n):
        y += lp * (random.uniform(-1, 1) - y)
        out.append(y * vol * env(i, n, a=0.0005, r=decay))
    return out

def mix(*parts, offsets=None):
    offsets = offsets or [0] * len(parts)
    n = max(int(o * SR) + len(p) for p, o in zip(parts, offsets))
    out = [0.0] * n
    for p, o in zip(parts, offsets):
        s = int(o * SR)
        for i, v in enumerate(p): out[s + i] += v
    return out

def echo(x, delay=0.11, fb=0.35, times=3):
    d = int(delay * SR); out = x + [0.0] * d * times
    for k in range(1, times + 1):
        for i, v in enumerate(x): out[i + d * k] += v * fb ** k
    return out

def save(skin, name, samples):
    peak = max(1e-6, max(abs(v) for v in samples)); g = 0.85 / peak
    path = os.path.join(ROOT, skin, "sfx", name); os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * g)) * 32767)) for v in samples))

# ---- standard: 乾いた、ダーツマシンらしい音 ----
save("standard", "tap.wav", mix(noise(0.02, 0.5, 0.004, 0.6), tone(1800, 0.05, "tri", 0.012, 0.5)))
save("standard", "seat.wav", mix(noise(0.06, 0.9, 0.012, 0.25), tone(220, 0.12, "sine", 0.04, 0.6, 140),
                                  tone(880, 0.09, "tri", 0.03, 0.35), tone(1320, 0.12, "tri", 0.04, 0.3), offsets=[0, 0, 0.05, 0.1]))
save("standard", "flip.wav", mix(noise(0.09, 0.8, 0.03, 0.7), tone(2400, 0.04, "sine", 0.01, 0.15, 3200)))
save("standard", "start.wav", mix(*[tone(f, 0.22, "square", 0.09, 0.28) for f in (523, 659, 784, 1047)],
                                   tone(1047, 0.5, "tri", 0.25, 0.35), offsets=[0, 0.08, 0.16, 0.24, 0.24]))

# ---- night: 電子的で残響のある音 ----
save("night", "tap.wav", echo(tone(1400, 0.06, "sine", 0.015, 0.6, 1700), 0.06, 0.25, 2))
save("night", "seat.wav", echo(mix(tone(330, 0.18, "saw", 0.06, 0.35, 660), tone(990, 0.15, "sine", 0.05, 0.4), offsets=[0, 0.06])))
save("night", "flip.wav", echo(mix(noise(0.07, 0.5, 0.02, 0.9), tone(600, 0.1, "sine", 0.03, 0.35, 1800)), 0.07, 0.3, 2))
save("night", "start.wav", echo(mix(*[tone(f, 0.25, "saw", 0.1, 0.22) for f in (440, 554, 659, 880)],
                                     tone(880, 0.6, "sine", 0.3, 0.4), offsets=[0, 0.09, 0.18, 0.27, 0.27]), 0.14, 0.35, 3))
def chirp_noise(dur, vol, f0, f1):
    """フィルタの開き具合を変えていくノイズ（風切り音）"""
    n = int(SR * dur); out = []; y = 0
    for i in range(n):
        lp = f0 + (f1 - f0) * i / n
        y += lp * (random.uniform(-1, 1) - y)
        out.append(y * vol * math.sin(math.pi * i / n))
    return out

def save_mp3(skin, name, samples):
    """BGM は大きいので mp3 にする（ffmpeg が要る）"""
    tmp = f"/tmp/{skin}-{name}.wav"
    peak = max(1e-6, max(abs(v) for v in samples)); g = 0.8 / peak
    with wave.open(tmp, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * g)) * 32767)) for v in samples))
    out = os.path.join(ROOT, skin, "sfx", name)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-b:a", "64k", out], check=True)
    os.remove(tmp)

def loop(parts, length):
    """繰り返したときに継ぎ目が分からないよう、はみ出した余韻を頭に重ねる"""
    n = int(length * SR); out = [0.0] * n
    for p, o in parts:
        s = int(o * SR)
        for i, v in enumerate(p): out[(s + i) % n] += v
    return out

NOTE = {"A": 0, "B": 2, "C": 3, "D": 5, "E": 7, "F": 8, "G": 10}
def hz(name, octave):
    return 440 * 2 ** ((NOTE[name] + (octave - 4) * 12 - (12 if NOTE[name] >= 3 else 0)) / 12)

def bgm(bpm, chords, bass_kind, arp_kind, pad_kind, drums, wet):
    beat = 60 / bpm; bars = len(chords); parts = []
    for b, chord in enumerate(chords):
        t0 = b * 4 * beat
        root = chord[0]
        # ベース：1拍目と3拍目、裏に軽く
        for k, off in enumerate((0, 1.5, 2, 3.5)):
            parts.append((tone(hz(root, 2), beat * 0.9, bass_kind, beat * 0.5, 0.32 if k % 2 == 0 else 0.2), t0 + off * beat))
        # アルペジオ：8分で和音を上下に
        seq = [hz(n, 4) for n in chord] + [hz(chord[0], 5)]
        order = [0, 1, 2, 3, 2, 1, 2, 3]
        for k, idx in enumerate(order):
            parts.append((tone(seq[idx], beat * 0.45, arp_kind, beat * 0.25, 0.1), t0 + k * beat / 2))
        # パッド：和音を小節いっぱいに薄く
        for n in chord:
            parts.append((tone(hz(n, 3), beat * 4, pad_kind, beat * 2.5, 0.045), t0))
        if drums:
            for k in range(4):
                parts.append((mix(tone(110, 0.14, "sine", 0.05, 0.5, 45), noise(0.02, 0.3, 0.005, 0.4)), t0 + k * beat))
            for k in range(8):
                parts.append((noise(0.04, 0.12 if k % 2 else 0.06, 0.01, 0.95), t0 + k * beat / 2))
    out = loop(parts, bars * 4 * beat)
    if wet:
        d = int(beat * 0.75 * SR); n = len(out); dry = out[:]
        for k in (1, 2, 3):
            for i in range(n): out[(i + d * k) % n] += dry[i] * 0.3 ** k
    return out

# ---- standard の追加 ----
save("standard", "select.wav", mix(noise(0.015, 0.4, 0.003, 0.7), tone(2200, 0.05, "tri", 0.01, 0.45), tone(2900, 0.04, "tri", 0.01, 0.25), offsets=[0, 0, 0.025]))
save("standard", "throw.wav", mix(chirp_noise(0.22, 0.7, 0.05, 0.6), tone(300, 0.2, "sine", 0.08, 0.25, 900)))
save("standard", "hit.wav", mix(noise(0.03, 1.0, 0.006, 0.5), tone(170, 0.16, "sine", 0.05, 0.9, 80), tone(1600, 0.12, "tri", 0.05, 0.3), tone(2400, 0.1, "tri", 0.04, 0.18), offsets=[0, 0, 0.01, 0.03]))
save("standard", "miss.wav", mix(noise(0.05, 0.4, 0.015, 0.15), tone(420, 0.22, "tri", 0.1, 0.35, 220)))
save("standard", "open.wav", mix(tone(784, 0.18, "tri", 0.08, 0.45), tone(1175, 0.3, "tri", 0.14, 0.45), tone(1568, 0.3, "sine", 0.14, 0.2), offsets=[0, 0.08, 0.08]))
save("standard", "award.wav", mix(*[tone(f, 0.16, "square", 0.07, 0.22) for f in (523, 659, 784, 1047, 1319)],
                                   tone(1568, 0.8, "tri", 0.4, 0.35), noise(0.5, 0.15, 0.2, 0.95),
                                   offsets=[0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.35]))
save("standard", "turn.wav", mix(tone(988, 0.2, "sine", 0.08, 0.5), tone(1319, 0.3, "sine", 0.12, 0.5), offsets=[0, 0.12]))
save_mp3("standard", "bgm.mp3", bgm(112, [list("ACE"), list("FAC"), list("CEG"), list("GBD")] * 2, "square", "tri", "tri", True, False))

# ---- night の追加 ----
save("night", "select.wav", echo(tone(1900, 0.04, "sine", 0.01, 0.5, 2300), 0.05, 0.25, 2))
save("night", "throw.wav", echo(mix(chirp_noise(0.25, 0.5, 0.1, 0.9), tone(200, 0.25, "saw", 0.1, 0.2, 1200)), 0.08, 0.3, 2))
save("night", "hit.wav", echo(mix(tone(140, 0.18, "sine", 0.06, 0.9, 60), tone(880, 0.2, "saw", 0.06, 0.25, 1760), noise(0.03, 0.6, 0.008, 0.6)), 0.09, 0.35, 3))
save("night", "miss.wav", echo(tone(330, 0.25, "sine", 0.1, 0.4, 165), 0.1, 0.3, 2))
save("night", "open.wav", echo(mix(tone(659, 0.2, "saw", 0.08, 0.25), tone(988, 0.3, "sine", 0.14, 0.45), offsets=[0, 0.08]), 0.12, 0.35, 3))
save("night", "award.wav", echo(mix(*[tone(f, 0.2, "saw", 0.08, 0.2) for f in (440, 554, 659, 880, 1109)],
                                     tone(1319, 0.9, "sine", 0.45, 0.4), offsets=[0, 0.08, 0.16, 0.24, 0.32, 0.4]), 0.15, 0.4, 3))
save("night", "turn.wav", echo(mix(tone(880, 0.2, "sine", 0.08, 0.45), tone(1175, 0.3, "sine", 0.12, 0.45), offsets=[0, 0.12]), 0.12, 0.3, 2))
save_mp3("night", "bgm.mp3", bgm(100, [list("DFA"), list("BDF"), list("FAC"), list("CEG")] * 2, "saw", "sine", "saw", True, True))
print("ok")
