"""Preprocess segments: trim -> 16:9 blur-fill -> grade -> audio process."""
import subprocess, os, glob

FF = subprocess.check_output(["/home/user/venv_py/bin/python","-c",
    "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
FILES = sorted(glob.glob("WhatsApp*.mp4"))
F = {i+1: f for i, f in enumerate(FILES)}
os.makedirs("_work/seg", exist_ok=True)

# (seg_id, section, src_c, ss, to, audio_mode, desc)
SEGS = [
 ("01_open",  "OPEN",  9, 8.40, 13.40, "voice", "girl1 answering"),
 ("02_nelum", "INTRO", 8, 2.00, 4.55, "voice", "Nelum speaking VP"),
 ("03_boy1",  "INTRO", 5, 0.00, 1.50, "voice", "boy1 answering"),
 ("04_mas",   "INTRO", 5, 2.35, 5.40, "voice", "Masooma"),
 ("05_mar1",  "INTRO", 7, 0.45, 2.65, "amb",   "Mariyam listening"),
 ("06_mar2",  "INTRO", 7, 2.65, 4.45, "amb",   "Mariyam engaging"),
 ("07a_mas2a","INTRO", 6, 2.95, 4.02, "amb",   "Masooma writing"),
 ("07b_mas2b","INTRO", 6, 4.02, 4.95, "voice", "Masooma speaking"),
 ("08_boy2",  "INTRO", 6, 7.60, 9.90, "amb",   "boy2 cutaway"),
 ("09_nelum2","INTRO", 8, 14.10, 15.70,"amb",  "Nelum listening VP"),
 ("10_g1a",   "HEART", 9, 0.10, 3.20, "voice", "girl1 interview"),
 ("11_g1b",   "HEART", 9, 3.57, 4.00, "voice", "girl1 cont (gap cut)"),
 ("12_g3",    "HEART", 7, 5.30, 9.00, "voice", "girl3 LEADER wall"),
 ("13_g2a",   "HEART",10, 0.50, 3.50, "voice", "girl2 interview"),
 ("14_g2b",   "HEART",10, 3.50, 5.37, "voice", "girl2 cont"),
 ("15_CORE",  "HEART",10, 6.90, 12.90,"voice", "EMOTIONAL CENTER girl2 hold"),
 ("16_g1c",   "HEART", 9, 6.30, 7.90, "voice", "girl1"),
 ("17_boy3",  "HEART", 8, 8.50, 10.50,"amb",   "boy3 thinking"),
 ("18_g1d",   "HEART", 9, 13.40, 14.70,"voice", "girl1"),
 ("19_board1","VOTE",  6, 0.00, 1.00, "amb",   "board broll"),
 ("20_board2","VOTE",  8, 0.05, 1.50, "amb",   "board broll2"),
 ("21_write1","VOTE",  6, 1.20, 2.80, "amb",   "Masooma writing wide"),
 ("22_write2","VOTE",  6, 10.40, 11.75,"amb",  "Masooma writing close"),
 ("23_desk",  "VOTE",  8, 4.60, 6.90, "amb",   "Nelum desk overseeing"),
 ("24_boy3b", "VOTE",  8, 10.90, 12.20,"amb",  "boy3 waiting"),
 ("25_smile", "CLOSE", 4, 4.60, 5.80, "tone",  "Masooma warm smile"),
]

GRADE = ("colorbalance=rs=0.05:gs=0.015:bs=-0.05:rm=0.035:gm=0.01:bm=-0.035,"
         "eq=contrast=1.05:saturation=1.06:brightness=0.015,"
         "unsharp=5:5:0.7:5:5:0.0")

def vfilter(crop_top=None):
    pre = f"crop=478:{850-crop_top}:0:{crop_top}," if crop_top else ""
    fg_scale = "scale=657:1080" if crop_top else "scale=607:1080"
    return (f"{pre}split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,"
            f"crop=1920:1080,gblur=sigma=40,eq=brightness=-0.18[bg];"
            f"[b]{fg_scale}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,{GRADE},fps=30")

AF = {
 "voice": "afftdn=nr=10,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
 "amb":   "afftdn=nr=12,highpass=f=80,loudnorm=I=-32:TP=-2:LRA=5,aresample=48000",
}

print("extracting room tone...")
subprocess.run([FF,"-hide_banner","-loglevel","error","-y","-ss","12.40",
    "-i",F[8],"-t","1.30","-vn","-ac","2","-ar","48000","-c:a","pcm_s16le",
    "_work/seg/roomtone.wav"], check=True)

ONLY = set(x for x in os.environ.get("ONLY","").split(",") if x)
totals = {}
for sid, sec, c, ss, to, amode, desc in SEGS:
    dur = round(to-ss, 2)
    totals[sec] = totals.get(sec, 0) + dur
    if ONLY and sid not in ONLY:
        print(f"skip {sid}", flush=True); continue
    out = f"_work/seg/{sid}.mp4"
    vf = vfilter(crop_top=64 if sid=="25_smile" else None)
    cmd = [FF,"-hide_banner","-loglevel","error","-y","-ss",f"{ss:.2f}","-i",F[c]]
    if amode == "tone":
        cmd += ["-stream_loop","3","-i","_work/seg/roomtone.wav",
                "-map","0:v","-map","1:a",
                "-vf",vf,"-af","aresample=48000,atrim=0:1.20",
                "-t",f"{dur:.2f}"]
    else:
        cmd += ["-vf",vf,"-af",AF[amode],"-t",f"{dur:.2f}"]
    cmd += ["-r","30","-c:v","libx264","-preset","fast","-crf","12",
            "-pix_fmt","yuv420p","-c:a","pcm_s16le","-ar","48000","-ac","2",out]
    print(f"{sid} {sec} c{c:02d}[{ss:.2f}-{to:.2f}]={dur:.2f}s {amode} :: {desc}", flush=True)
    subprocess.run(cmd, check=True)

print("\nSECTION TOTALS:")
grand = 0
for s in ["OPEN","INTRO","HEART","VOTE","CLOSE"]:
    print(f"  {s}: {totals[s]:.2f}s"); grand += totals[s]
print(f"  FOOTAGE TOTAL: {grand:.2f}s  -> card = {60-grand:.2f}s")
