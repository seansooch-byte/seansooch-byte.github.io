# Lions Simulator builder

Offline, reproducible. Needs Python 3 with pandas and numpy; reads the nflverse 2026 play-by-play file and writes
`lions/simulator/data/sim.json`, which `lions/simulator/` draws. Nothing is fetched at run time and the page does no maths.

    curl -L -o /tmp/pbp2026.csv.gz https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv.gz
    python3 -I tools/lions-sim/build.py --pbp /tmp/pbp2026.csv.gz --away GB --home DET \
        --kickoff 2026-10-25T20:25:00Z --focus DET --sims 10000 --seed 2026 --validate \
        --out lions/simulator/data/sim.json

- `fit.py`: every table, rate and list is counted from the file and shrunk toward the league (ridge logit offsets, gamma-Poisson rates).
- `engine.py`: the play-level game simulation (one seed per game). `build.py`: calibration, simulation, the typical-game pick, output.
- `--validate` replays all real 2026 games and compares simulated with real per-team-game numbers (stored in the JSON).
- Minimum 5,000 sims (`--dev` lifts that for debugging). Method text lives in `METHOD` in `build.py` and is shown on the page.
- Known gap: simulated scoring runs about 6% under real 2026 scoring (see the validation block); kick-return touchdowns, timeouts and onside kicks are not modelled.
