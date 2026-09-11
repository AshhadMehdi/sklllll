# Student Council Elections 2026 — Edit Notes

**Deliverable:** `Student_Council_Elections_2026.mp4`
60.00s · 1920×1080 · 30fps · H.264 + AAC · ~52 MB · faststart enabled (Facebook-ready)

## Timeline (exact)
| Time | Section | Content |
|------|---------|---------|
| 0:00–0:05 | Opening hook | Girl candidate answering + title card |
| 0:05–0:22 | Introductions | VP Nelum → boy candidate → Masooma → Mariyam ×2 → Masooma → boy → VP |
| 0:22–0:45 | Heart | Candidate montage, 6.0s emotional-center hold (girl, library interview) |
| 0:45–0:54 | Every voice. Every vote. | Election board, teachers writing/overseeing, candidates |
| 0:54–0:55.2 | Closing hold | Ms. Masooma warm smile |
| 0:55.2–1:00 | Card | 0.15s crossfade into maroon thank-you card |

## Spec compliance
- Only uploaded clips used; hard cuts throughout + one 0.15s final crossfade
- Voices only: no music, no SFX. Music track left empty for your own mix
- Voice segments normalized to −16 LUFS; ambience beds at −32 LUFS; light denoise + 80 Hz high-pass
- Poppins throughout; lower thirds once per person (2s, fade); no text over faces
- One small emoji on title (🗳️), one on closing card (👀); zero mid-video
- Ends with clean digital silence (last 0.3s at −91 dB)

## Adaptations forced by the source footage
1. **No ballot/voting footage exists** in the uploads (all clips are interviews + intro cards).
   The "Voting" section is therefore an "Every voice. Every vote." montage of the election
   board, teachers writing/overseeing, and candidates.
2. **No Headmistress appears** in any clip. People present: Ms. Nelum (Vice Principal),
   Ms. Masooma (Senior Mistress), Ms. Mariyam (Teacher), Sir Munhim (Teacher), 6 candidates.
3. **Intro cards (first 4 clips) were excluded**: they contain burned-in CapCut sticker text,
   a CapCut watermark, and an identical template-music track (byte-identical audio, no voices).
   One exception: 1.2s of Ms. Masooma's clean smile (sticker-free window, watermark cropped,
   template music replaced with the event's own room tone) for the warm closing shot.
4. **All footage is vertical 478×850**, so 16:9 was achieved with a darkened blurred-fill
   background (center crop would have decapitated every subject).
5. **Interview audio was recorded very quietly** (distant phone mic, ≈−40 dB RMS) and was
   boosted with denoising. Voices are clear but the source noise floor is audible in places.
6. **Name spellings** follow your footage (desk plate "NEELUM NISAR", on-screen labels
   "Ms. Masooma", "Ms. Mariyam") rather than the brief's "Neelam/Masuma/Maryam" — say the
   word if you'd like them changed (one-command re-render).
7. A camera bump with handling noise (~5s into the library girl interview) was cut.

## Reproducing / tweaking
- ` _work/build_segments.py` — cut list + grade + audio (edit SEG table, re-run)
- `_work/make_text.py` — all text cards (Poppins, edit strings, re-run)
- `_work/assemble.py` — concat + overlays + crossfade + final encode
- Needs: python3 + `pip install imageio-ffmpeg pillow` (GitHub access for fonts/emoji)
