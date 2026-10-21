#!/usr/bin/env python3
"""Lions Simulator builder. Reads nflverse 2026 play-by-play, fits the model, runs N game simulations and writes
lions/simulator/data/sim.json (win probability, score histograms, the "most typical" game's full drive-by-drive log).

  python3 -I tools/lions-sim/build.py --pbp /tmp/pbp2026.csv.gz --away GB --home DET \\
      --kickoff 2026-10-25T20:25:00Z --sims 10000 --seed 2026 --out lions/simulator/data/sim.json
Add --validate to also replay the real schedule and compare simulated points per game with real ones."""
import argparse, hashlib, json, os, random, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fit as F
from engine import Matchup, Game

TEAMS = {
 'ARI': ('Arizona Cardinals', '#97233F'), 'ATL': ('Atlanta Falcons', '#A71930'), 'BAL': ('Baltimore Ravens', '#241773'),
 'BUF': ('Buffalo Bills', '#00338D'), 'CAR': ('Carolina Panthers', '#0085CA'), 'CHI': ('Chicago Bears', '#0B162A'),
 'CIN': ('Cincinnati Bengals', '#FB4F14'), 'CLE': ('Cleveland Browns', '#311D00'), 'DAL': ('Dallas Cowboys', '#003594'),
 'DEN': ('Denver Broncos', '#FB4F14'), 'DET': ('Detroit Lions', '#0076B6'), 'GB': ('Green Bay Packers', '#203731'),
 'HOU': ('Houston Texans', '#03202F'), 'IND': ('Indianapolis Colts', '#002C5F'), 'JAX': ('Jacksonville Jaguars', '#006778'),
 'KC': ('Kansas City Chiefs', '#E31837'), 'LA': ('Los Angeles Rams', '#003594'), 'LAC': ('Los Angeles Chargers', '#0080C6'),
 'LV': ('Las Vegas Raiders', '#000000'), 'MIA': ('Miami Dolphins', '#008E97'), 'MIN': ('Minnesota Vikings', '#4F2683'),
 'NE': ('New England Patriots', '#002244'), 'NO': ('New Orleans Saints', '#D3BC8D'), 'NYG': ('New York Giants', '#0B2265'),
 'NYJ': ('New York Jets', '#125740'), 'PHI': ('Philadelphia Eagles', '#004C54'), 'PIT': ('Pittsburgh Steelers', '#FFB612'),
 'SEA': ('Seattle Seahawks', '#002244'), 'SF': ('San Francisco 49ers', '#AA0000'), 'TB': ('Tampa Bay Buccaneers', '#D50A0A'),
 'TEN': ('Tennessee Titans', '#4B92DB'), 'WAS': ('Washington Commanders', '#5A1414')}

METHOD = [
 "Data: nflverse play-by-play for the 2026 regular season only (every play of every game through Week {week}, last game {asof}). Nothing from earlier seasons, no betting lines, no depth charts, no injury reports.",
 "Shrinkage: every team or player rate is pulled toward the league rate. Rates use (events + n0 x league rate) / (n + n0) with n0 pseudo-plays (sack 60-80, interception 250, fumble 300, penalties 150, kicker/punter tables 15). Completion odds and play-calling use logit offsets with a ridge (normal) prior: offset = sum(y - p) / (sum p(1-p) + lambda), lambda 8 for team play-calling, 11 for a receiver, 25 for a quarterback or defense, 6 for a kicker. Yard distributions are mixtures: a player's own plays with weight n / (n + 25 to 40), the league list otherwise.",
 "Play-calling: dropback share by down, distance bucket and score/time context (normal, hurry, milk) from all 2026 plays, plus a shrunk team offset. Fourth-down go / field goal / punt odds come from the league's 2026 fourth downs by field zone and distance, with a late-trailing override (go unless a field goal is within range and within one score).",
 "Dropbacks: sack rate (offence x defence), scramble rate (QB), interception rate (QB x defence), then a target drawn by the team's 2026 target share. Completion odds = league + QB + receiver + defence offsets. Yards come from the receiver's own completions or the league list scaled by team and opponent yards-per-completion. Runs: a rusher drawn by carry share, yards from his own carries or the league list, scaled by the opponent's yards per carry allowed. Touchdowns happen when the yards reach the goal line, so there is no separate touchdown rate to invent.",
 "Other pieces: accepted penalties (rate x opponent rate, yards and automatic-first-down share from the file), fumbles lost, interception and fumble return yards, safeties, punts (the punter's gross and return distribution), field goals (a logistic curve in kick distance fit on 2026 kicks, plus a shrunk kicker offset), extra points and two-point tries at the 2026 league rates, kickoff starting spots from 2026 drives that began on a kickoff.",
 "Clock: seconds to the next snap are drawn from 2026 plays of the same type and context, so hurry-up and clock-killing tempo come from the file. Teams kneel to end the game. Timeouts, the two-minute warning, onside kicks, challenges, injuries, weather and home-field advantage are not modelled.",
 "Overtime: ten minutes, a random coin toss, both teams get a possession unless the defence scores; after that, sudden death. Still tied at the end: a tie.",
 "{n} games are simulated with seeds {seed}.. (one seed per game, so the whole run reproduces). The most typical game is the simulated game with the smallest standardised distance to the medians of: both teams' points (counted twice), the margin, both teams' total yards, both teams' turnovers and the total number of plays.",
]

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def ypp_sd(T, gs, per_game, seed):
    v = []
    for gi, r in enumerate(gs.itertuples()):
        M = [Matchup(T, r.a, r.h), Matchup(T, r.h, r.a)]
        for i in range(per_game):
            g = Game(T, M, random.Random(seed * 100003 + gi * 997 + i), ['A', 'H'], log=False)
            _, st = g.run()
            v += [st[0]['yds'] / max(st[0]['plays'], 1), st[1]['yds'] / max(st[1]['plays'], 1)]
    return float(np.std(v))

def calibrate(T, pbp, iters=3, per_game=60, seed=11):
    """Five league-wide constants, none fit to points:
      sigma  - game-to-game spread of an offence's yardage (a lognormal multiplier per team per game), set so the spread of
               yards per play across simulated team-games over the real 2026 schedule equals the real spread;
      pass / rush - scales on the situational yard lists so simulated yards per completion and per designed carry equal the
               2026 league means (sampling, the goal-line cap and shrunk multipliers drift them by a few percent);
      call   - a play-calling logit shift so the simulated dropback share equals the league's;
      rz     - a scale on yards inside the 20 so the simulated touchdown share of red-zone snaps equals the league's."""
    gs = F.final_scores(pbp)
    sc = pbp[pbp.play_type.isin(['run', 'pass']) & pbp.posteam.notna()]
    rp = sc.groupby(['game_id', 'posteam']).agg(y=('yards_gained', 'sum'), n=('yards_gained', 'size'))
    target = float(np.std(rp.y / rp.n))
    T['cal']['sigma'] = 0.0
    v0 = ypp_sd(T, gs, 20, seed) ** 2
    T['cal']['sigma'] = 0.10
    v1 = ypp_sd(T, gs, 20, seed) ** 2
    k = max((v1 - v0) / 0.10 ** 2, 1e-6)
    T['cal']['sigma'] = float(np.sqrt(max(target ** 2 - v0, 0.0) / k))
    for it in range(iters):
        cy = cn = ry = rn = db_ = sp_ = rzp = rztd = 0.0
        for gi, r in enumerate(gs.itertuples()):
            M = [Matchup(T, r.a, r.h), Matchup(T, r.h, r.a)]
            for i in range(per_game):
                g = Game(T, M, random.Random(seed * 100003 + gi * 997 + it * 31 + i), ['A', 'H'], log=False)
                _, st = g.run()
                for kk in (0, 1):
                    cy += st[kk]['pass_yds_c']; cn += st[kk]['comp_n']; ry += st[kk]['ry']; rn += st[kk]['rn']; db_ += st[kk]['dbk']; sp_ += st[kk]['sp']; rzp += st[kk]['rzp']; rztd += st[kk]['rztd']
        T['cal']['pass'] *= T['lg']['yac_mean'] / (cy / cn)
        T['cal']['rush'] *= T['lg']['rush_mean'] / (ry / rn)
        T['cal']['call'] += F.logit(T['lg']['db_share']) - F.logit(db_ / sp_)
        T['cal']['rz'] *= (T['lg']['rz_td'] / (rztd / rzp)) ** 1.5
    return dict(sigma=round(float(T['cal']['sigma']), 4), target_ypp_sd=round(target, 3), sim_ypp_sd_at_zero=round(v0 ** .5, 3),
                pass_scale=round(float(T['cal']['pass']), 4), rush_scale=round(float(T['cal']['rush']), 4), call_logit=round(float(T['cal']['call']), 4), rz_scale=round(float(T['cal']['rz']), 4))

def neutral_def(T):
    T['def_comp']['LGAVG'] = 0.0; T['def_sack']['LGAVG'] = 1.0; T['def_int']['LGAVG'] = 1.0
    T['def_comp_y']['LGAVG'] = 1.0; T['def_rush_y']['LGAVG'] = 1.0; T['pen_def']['LGAVG'] = 1.0

XK = ['plays', 'yds', 'tov', 'fd', 'att', 'comp', 'rush', 'sacks', 'drives', 'fg', 'fga', 'punts', 'pen', 'td', 'pass_yds', 'rush_yds']

def run_sims(T, a, h, n, seed, names):
    M = [Matchup(T, a, h), Matchup(T, h, a)]
    out = np.zeros((n, 16)); extra = np.zeros((n, 2, len(XK)))
    for i in range(n):
        g = Game(T, M, random.Random(seed * 1000003 + i), names, log=False)
        sc, st = g.run()
        out[i] = [sc[0], sc[1], st[0]['yds'], st[1]['yds'], st[0]['tov'], st[1]['tov'], st[0]['plays'] + st[1]['plays'],
                  1 if g.ot else 0, st[0]['drives'], st[1]['drives'], st[0]['att'], st[1]['att'], st[0]['plays'], st[1]['plays'],
                  st[0]['sacks'], st[1]['sacks']]
        for k in (0, 1):
            extra[i, k] = [st[k][x] for x in XK]
    run_sims.extra = extra
    return out, M

def typical(out):
    # features: pts_a (x2), pts_h (x2), margin, yds_a, yds_h, tov_a, tov_h, plays
    f = np.c_[out[:, 0], out[:, 1], out[:, 1] - out[:, 0], out[:, 2], out[:, 3], out[:, 4], out[:, 5], out[:, 6]]
    w = np.array([2, 2, 1, 1, 1, 1, 1, 1], float)
    med = np.median(f, axis=0); sd = f.std(axis=0); sd[sd == 0] = 1
    dist = np.sqrt((w * ((f - med) / sd) ** 2).sum(axis=1))
    return int(np.argmin(dist)), med, float(dist.min())

def profile(T, t, res):
    o, d = T['off'][t], T['def'][t]; q = T['qb'][t]
    recs = T['rec'][t]; tot = sum(r['targets'] for r in recs)
    rush = T['rush'][t]; ct = sum(r['carries'] for r in rush)
    k = T['kicker'].get(t); p = T['punter'].get(t)
    lg = T['lg']
    return dict(
        games=res[t]['games'], ppg=round(res[t]['ppg'], 1), papg=round(res[t]['papg'], 1),
        off=dict(pass_rate=round(o['pass_rate'], 3), epa_db=round(o['epa_db'], 3), epa_rush=round(o['epa_rush'], 3),
                 ypc=round(o['ypc'], 2), ypa=round(o['ypa'], 2), comp_pct=round(o['n_comp'] / max(o['n_ni'], 1), 3),
                 sack_rate=round(o['n_sack'] / max(o['n_db'], 1), 3)),
        dfn=dict(epa_db=round(de_val(d, 'epa_db'), 3), epa_rush=round(de_val(d, 'epa_rush'), 3), ypc=round(d['ypc'], 2),
                 ypa=round(d['ypa'], 2), sack_rate=round(d['n_sack'] / max(d['n_db'], 1), 3),
                 comp_pct=round(d['n_comp'] / max(d['n_ni'], 1), 3), int_rate=round(d['n_int'] / max(d['n_att'], 1), 3)),
        qb=dict(name=q['name'], att=q['n_att'], comp=q['comp'], yds=int(q['yds']), td=q['td'], ints=q['ints'], sacks=q['sacks'], epa=round(q['epa'], 3)),
        targets=[dict(name=r['name'], share=round(r['targets'] / tot, 3), targets=r['targets'], catch=round(r['comp'] / max(r['n_ni'], 1), 3),
                      yds=int(r['yds']), td=r['td']) for r in recs[:6] if r['name'] != '(throwaway)'],
        carries=[dict(name=r['name'], share=round(r['carries'] / ct, 3), carries=r['carries'], ypc=round(r['yds'] / r['carries'], 2),
                      td=r['td']) for r in rush[:4]],
        kicker=dict(name=k['name'], made=k['made'], att=k['att']) if k else None,
        punter=dict(name=p['name'], n=p['n'], avg=round(float(np.mean([x[0] for x in p['list']])), 1)) if p else None,
        adj=dict(call_logit=round(T['call_off'][t], 3), comp_logit_qb=round(q['comp_off'], 3), def_comp_logit=round(T['def_comp'][t], 3),
                 def_sack=round(T['def_sack'][t], 3), def_int=round(T['def_int'][t], 3), def_rush_yards=round(T['def_rush_y'][t], 3),
                 def_pass_yards=round(T['def_comp_y'][t], 3), pen_off=round(T['pen_off'][t], 3), pen_def=round(T['pen_def'][t], 3)))

def de_val(d, k):
    return d[k]

def real_team_stats(pbp):
    """Real per-team-game numbers for the sanity table."""
    sc = pbp[pbp.play_type.isin(['run', 'pass']) & pbp.posteam.notna()]
    g = sc.groupby('posteam')
    n_games = {t: F.ngames(pbp, t) for t in sc.posteam.unique()}
    dr = pbp[pbp.posteam.notna() & pbp.drive.notna()].groupby('posteam').apply(lambda x: x[['game_id', 'drive']].drop_duplicates().shape[0])
    out = {}
    for t in n_games:
        s = g.get_group(t)
        out[t] = dict(plays=len(s) / n_games[t], yds=float(s.yards_gained.sum()) / n_games[t],
                      tov=float((s.interception.fillna(0).sum() + s.fumble_lost.fillna(0).sum())) / n_games[t],
                      drives=float(dr[t]) / n_games[t], pass_rate=float((s.qb_dropback == 1).mean()))
    return out

def validate(T, pbp, res, seed, per_game=300):
    gs = F.final_scores(pbp)
    names = ['A', 'H']
    sim_pts = {t: [] for t in T['teams']}; sim_o = {t: [] for t in T['teams']}; sim_x = {t: [] for t in T['teams']}; gi = 0
    for r in gs.itertuples():
        out, _ = run_sims(T, r.a, r.h, per_game, seed + 77 + 7919 * gi, names)
        gi += 1
        ex = run_sims.extra.mean(axis=0)
        for k, t in ((0, r.a), (1, r.h)):
            sim_x[t].append(ex[k])
        sim_pts[r.a].append(out[:, 0].mean()); sim_pts[r.h].append(out[:, 1].mean())
        sim_o[r.a].append([out[:, 12].mean(), out[:, 2].mean(), out[:, 4].mean(), out[:, 8].mean(), out[:, 10].mean() / max(out[:, 12].mean(), 1)])
        sim_o[r.h].append([out[:, 13].mean(), out[:, 3].mean(), out[:, 5].mean(), out[:, 9].mean(), out[:, 11].mean() / max(out[:, 13].mean(), 1)])
    real = real_team_stats(pbp)
    rows = []
    for t in T['teams']:
        so = np.mean(sim_o[t], axis=0)
        rows.append(dict(team=t, sim_ppg=round(float(np.mean(sim_pts[t])), 1), real_ppg=round(res[t]['ppg'], 1),
                         sim_plays=round(float(so[0]), 1), real_plays=round(real[t]['plays'], 1),
                         sim_yds=round(float(so[1]), 0), real_yds=round(real[t]['yds'], 0),
                         sim_tov=round(float(so[2]), 2), real_tov=round(real[t]['tov'], 2),
                         sim_drives=round(float(so[3]), 1), real_drives=round(real[t]['drives'], 1)))
    sp = np.array([r['sim_ppg'] for r in rows]); rp = np.array([r['real_ppg'] for r in rows])
    sc = pbp[pbp.play_type.isin(['run', 'pass']) & pbp.posteam.notna()]
    G = sum(F.ngames(pbp, t) for t in T['teams'])   # team-games
    att_ = sc[(sc.qb_dropback == 1) & (sc.sack == 0) & (sc.qb_scramble == 0)]
    drv = pbp[pbp.posteam.notna() & pbp.drive.notna()].groupby(['game_id', 'drive', 'posteam']).fixed_drive_result.first()
    realx = dict(plays=len(sc) / G, yds=sc.yards_gained.sum() / G, tov=(sc.interception.sum() + sc.fumble_lost.sum()) / G,
                 fd=sc.first_down.sum() / G, att=len(att_) / G, comp=att_.complete_pass.sum() / G,
                 rush=((sc.qb_dropback == 0).sum() + sc.qb_scramble.sum()) / G, sacks=sc.sack.sum() / G,
                 drives=len(drv) / G, fg=(drv == 'Field goal').sum() / G, fga=((drv == 'Field goal') | (drv == 'Missed field goal')).sum() / G,
                 punts=(drv == 'Punt').sum() / G, td=(drv == 'Touchdown').sum() / G,
                 pass_yds=sc[(sc.qb_dropback == 1) & (sc.qb_scramble == 0)].yards_gained.sum() / G,
                 rush_yds=sc[(sc.qb_dropback == 0) | (sc.qb_scramble == 1)].yards_gained.sum() / G)
    simx = np.mean([np.mean(sim_x[t], axis=0) for t in T['teams']], axis=0)
    detail = {k: dict(sim=round(float(simx[XK.index(k)]), 2), real=round(float(realx[k]), 2)) for k in realx}
    summ = dict(per_team_game=detail, games_replayed=int(len(gs)), sims_per_game=per_game,
                league_sim_ppg=round(float(sp.mean()), 2), league_real_ppg=round(float(rp.mean()), 2),
                mae_ppg=round(float(np.abs(sp - rp).mean()), 2), corr_ppg=round(float(np.corrcoef(sp, rp)[0, 1]), 3),
                league_sim_plays=round(float(np.mean([r['sim_plays'] for r in rows])), 1),
                league_real_plays=round(float(np.mean([r['real_plays'] for r in rows])), 1),
                league_sim_yds=round(float(np.mean([r['sim_yds'] for r in rows])), 0),
                league_real_yds=round(float(np.mean([r['real_yds'] for r in rows])), 0),
                league_sim_tov=round(float(np.mean([r['sim_tov'] for r in rows])), 2),
                league_real_tov=round(float(np.mean([r['real_tov'] for r in rows])), 2),
                league_sim_drives=round(float(np.mean([r['sim_drives'] for r in rows])), 1),
                league_real_drives=round(float(np.mean([r['real_drives'] for r in rows])), 1))
    return summ, rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pbp', required=True); ap.add_argument('--away', required=True); ap.add_argument('--home', required=True)
    ap.add_argument('--kickoff', required=True, help='ISO UTC, e.g. 2026-10-25T20:25:00Z'); ap.add_argument('--focus', default='DET')
    ap.add_argument('--sims', type=int, default=10000); ap.add_argument('--seed', type=int, default=2026)
    ap.add_argument('--out', required=True); ap.add_argument('--dev', action='store_true', help='allow fewer than 5,000 sims (debugging only)'); ap.add_argument('--validate', action='store_true')
    ap.add_argument('--source-url', default='https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2026.csv.gz')
    a = ap.parse_args()
    assert a.dev or a.sims >= 5000, 'at least 5,000 simulations'
    t0 = time.time()
    pbp = F.load(a.pbp)
    asof = str(pbp.game_date.max()); week = int(pbp.week.max())
    T = F.fit(pbp)
    neutral_def(T)
    cal = calibrate(T, pbp)
    print('calibration', cal)
    res = F.team_results(pbp)
    for t in (a.away, a.home):
        assert t in T['teams'], t
    names = [a.away, a.home]
    print(f'fit done {time.time()-t0:.1f}s; plays {T["n_scrim"]}')
    out, M = run_sims(T, a.away, a.home, a.sims, a.seed, names)
    print(f'{a.sims} sims {time.time()-t0:.1f}s')
    n = a.sims
    pa, ph = out[:, 0], out[:, 1]
    pw = dict(away=float((pa > ph).mean()), home=float((ph > pa).mean()), tie=float((pa == ph).mean()))
    idx, med, dmin = typical(out)
    # replay the chosen sim with logging, same seed
    g = Game(T, M, random.Random(a.seed * 1000003 + idx), names, log=True)
    sc, st = g.run()
    assert [sc[0], sc[1]] == [out[idx, 0], out[idx, 1]], 'replay differs from the simulated game'
    assert st[0]['yds'] == out[idx, 2] and st[1]['yds'] == out[idx, 3]
    drives = [d for d in g.drives if d is not None]
    hmax = 70
    hist = lambda v: np.bincount(np.clip(v.astype(int), 0, hmax), minlength=hmax + 1).tolist()
    mg = (ph - pa).astype(int); mlo, mhi = -50, 50
    mh = np.bincount(np.clip(mg, mlo, mhi) - mlo, minlength=mhi - mlo + 1).tolist()
    tot = (pa + ph).astype(int)
    q = lambda v: [float(np.percentile(v, p)) for p in (10, 25, 50, 75, 90)]
    validation = None
    if a.validate:
        summ, rows = validate(T, pbp, res, a.seed)
        validation = dict(summary=summ, teams=rows)
        print(json.dumps(summ, indent=1))
    focus_tm = lambda: None
    ta = {t: dict(name=TEAMS[t][0], color=TEAMS[t][1], abbr=t, profile=profile(T, t, res)) for t in (a.away, a.home)}
    stat_keys = ['plays', 'yds', 'pass_yds', 'rush_yds', 'tov', 'fd', 'att', 'comp', 'rush', 'sacks', 'drives', 'fg', 'fga', 'punts', 'pen', 'td']
    doc = dict(
        meta=dict(title=f'{TEAMS[a.away][0]} at {TEAMS[a.home][0]}', away=a.away, home=a.home, focus=a.focus, kickoff_utc=a.kickoff,
                  data_as_of=asof, through_week=week, source_url=a.source_url, source_sha256=sha256(a.pbp),
                  n_sims=n, seed=a.seed, plays_in_file=int(len(pbp)), scrimmage_plays=T['n_scrim'], builder='tools/lions-sim/build.py'),
        teams=ta,
        result=dict(p_win=pw, mean_pts=dict(away=float(pa.mean()), home=float(ph.mean())), pts_quantiles=dict(away=q(pa), home=q(ph)),
                    margin_quantiles=q(ph - pa), total_quantiles=q(pa + ph), ot_rate=float(out[:, 7].mean()),
                    hist_pts=dict(away=hist(pa), home=hist(ph), max=hmax), hist_margin=dict(lo=mlo, hi=mhi, counts=mh),
                    hist_total=np.bincount(np.clip(tot, 0, 120), minlength=121).tolist(),
                    p_over_30=dict(away=float((pa >= 30).mean()), home=float((ph >= 30).mean()))),
        typical=dict(
            definition="The simulated game closest (standardised distance) to the medians of both teams' points (weighted double), the margin, both teams' total yards, both teams' turnovers and total plays.",
            sim_index=idx, distance=dmin,
            medians=dict(away_pts=float(med[0]), home_pts=float(med[1]), margin=float(med[2]), away_yds=float(med[3]), home_yds=float(med[4]),
                         away_tov=float(med[5]), home_tov=float(med[6]), plays=float(med[7])),
            final=[int(sc[0]), int(sc[1])], ot=bool(g.ot), stats=[{k: int(st[i][k]) for k in stat_keys} for i in (0, 1)],
            n_drives=len(drives), drives=drives),
        validation=validation, calibration=cal,
        method=[m.format(week=week, asof=asof, n=f'{n:,}', seed=a.seed) for m in METHOD],
        model=dict(fg_curve=dict(intercept_at_40=T['fg_w'][0], per_yard=T['fg_w'][1], n_kicks=T['n_fg']), xp=T['xp'], two_point=T['two'],
                   league=dict(comp=T['lg']['comp'], sack=T['lg']['sack'], interception=T['lg']['int'], yards_per_comp=T['lg']['yac_mean'],
                               yards_per_rush=T['lg']['rush_mean'])))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    print(f"P({a.away})={pw['away']:.3f} P({a.home})={pw['home']:.3f} tie={pw['tie']:.4f}; mean {a.away} {pa.mean():.1f} {a.home} {ph.mean():.1f}")
    print(f"typical game idx {idx}: {a.away} {sc[0]} - {a.home} {sc[1]} ; real ppg {res[a.away]['ppg']:.1f} / {res[a.home]['ppg']:.1f}; wrote {os.path.getsize(a.out)} bytes in {time.time()-t0:.0f}s")

if __name__ == '__main__':
    main()
