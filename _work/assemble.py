"""Concat segments, burn overlays, xfade to card, finish audio -> final MP4."""
import subprocess, glob, os

FF = subprocess.check_output(["/home/user/venv_py/bin/python","-c",
    "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()

segs = sorted(glob.glob("_work/seg/[0-9]*.mp4"))
with open("_work/seg/list.txt","w") as f:
    for s in segs:
        f.write(f"file '{os.path.abspath(s)}'\n")
print(f"concat {len(segs)} segments...")
subprocess.run([FF,"-hide_banner","-loglevel","error","-y","-f","concat","-safe","0",
    "-i","_work/seg/list.txt","-c","copy","_work/base.mp4"], check=True)

fc = (
 "[1:v]format=rgba,fade=t=in:st=0.4:d=0.5:alpha=1,fade=t=out:st=4.2:d=0.5:alpha=1[t1];"
 "[0:v]trim=0:55.2,setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0];"
 "[v0][t1]overlay=0:0:enable='between(t,0.4,4.7)'[v1];"
 "[2:v]format=rgba,fade=t=in:st=5.3:d=0.3:alpha=1,fade=t=out:st=7.0:d=0.3:alpha=1[t2];"
 "[v1][t2]overlay=0:0:enable='between(t,5.3,7.3)'[v2];"
 "[3:v]format=rgba,fade=t=in:st=9.35:d=0.3:alpha=1,fade=t=out:st=11.05:d=0.3:alpha=1[t3];"
 "[v2][t3]overlay=0:0:enable='between(t,9.35,11.35)'[v3];"
 "[4:v]format=rgba,fade=t=in:st=12.3:d=0.3:alpha=1,fade=t=out:st=14.0:d=0.3:alpha=1[t4];"
 "[v3][t4]overlay=0:0:enable='between(t,12.3,14.3)'[v4];"
 "[5:v]format=rgba,fade=t=in:st=47.0:d=0.5:alpha=1,fade=t=out:st=51.5:d=0.5:alpha=1[t5];"
 "[v4][t5]overlay=0:0:enable='between(t,47.0,52.0)'[v5];"
 "[v5]fps=30,settb=AVTB,format=yuv420p[vm];"
 "[6:v]trim=start=0:end=4.95,setpts=PTS-STARTPTS,fps=30,settb=AVTB,format=yuv420p[card];"
 "[vm][card]xfade=transition=fade:duration=0.15:offset=55.05[vout];"
 "[0:a]afade=t=out:st=55.0:d=0.2,atrim=0:55.2,apad,atrim=0:60[aout]"
)
cmd = [FF,"-hide_banner","-loglevel","error","-y",
 "-i","_work/base.mp4",
 "-loop","1","-framerate","30","-t","4.7","-i","_work/ov_title.png",
 "-loop","1","-framerate","30","-t","7.3","-i","_work/ov_lt1.png",
 "-loop","1","-framerate","30","-t","11.35","-i","_work/ov_lt2.png",
 "-loop","1","-framerate","30","-t","14.3","-i","_work/ov_lt3.png",
 "-loop","1","-framerate","30","-t","52.0","-i","_work/ov_vote.png",
 "-loop","1","-framerate","30","-t","4.95","-i","_work/card.png",
 "-filter_complex",fc,
 "-map","[vout]","-map","[aout]",
 "-t","60","-r","30",
 "-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p",
 "-c:a","aac","-b:a","128k","-ar","48000","-ac","2",
 "-movflags","+faststart",
 "Student_Council_Elections_2026.mp4"]
print("rendering final...")
subprocess.run(cmd, check=True)
print("FINAL DONE")
