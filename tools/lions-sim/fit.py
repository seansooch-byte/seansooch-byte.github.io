"""Fit every model table from the nflverse 2026 play-by-play file. Nothing here is typed in by hand:
each rate, list and curve is counted from the file and shrunk toward the league (see METHOD in build.py)."""
import math
import numpy as np
import pandas as pd

def sig(x):
    return 1.0 / (1.0 + math.exp(-x))

def logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))

def ridge_offset(y, p, lam):
    """One ridge-penalised Newton step for a logit offset (normal prior, sd = lam**-0.5). y: outcomes, p: league
    expectation per row. Few rows -> offset near 0; many rows -> the observed log-odds gap."""
    y = np.asarray(y, float); p = np.asarray(p, float)
    if len(y) == 0:
        return 0.0
    return float((y - p).sum() / ((p * (1 - p)).sum() + lam))

def shrunk(events, n, lg, n0):
    """Gamma-Poisson style: league rate worth n0 pseudo-observations."""
    return (events + n0 * lg) / (n + n0)

def db(togo):
    return 0 if togo <= 2 else 1 if togo <= 6 else 2 if togo <= 10 else 3

def dbin(togo):
    return 0 if togo <= 1 else 1 if togo <= 2 else 2 if togo <= 4 else 3 if togo <= 6 else 4 if togo <= 8 else 5 if togo <= 10 else 6 if togo <= 14 else 7

def skey(yl, down, togo):
    """Situation key: inside the 25 the yard line (<=5, 6-12, 13-25) and a coarse distance (<=3, 4-9, 10+); elsewhere the
    down (1, 2, 3+) and the distance bin."""
    if yl <= 25:
        return (10 if yl <= 5 else 11 if yl <= 12 else 12, 0 if togo <= 3 else 1 if togo <= 9 else 2)
    return (int(min(down, 3)), dbin(togo))

SKEYS = [(z, b) for z in (1, 2, 3) for b in range(8)] + [(z, b) for z in (10, 11, 12) for b in range(3)]

def yb(yl):
    return 0 if yl >= 80 else 1 if yl >= 60 else 2 if yl >= 45 else 3 if yl >= 35 else 4 if yl >= 20 else 5

CTXS = ('normal', 'hurry', 'milk', 'twomin')

def ctx_of(q, sec, hs, diff):
    """Score/time context for play-calling and tempo, from the offence's point of view: milk (leading late), hurry
    (trailing late in the fourth), twomin (last two minutes of the first half, or of the game when not ahead)."""
    if q == 5:
        return 'normal'
    if q == 4 and ((sec <= 900 and diff >= 9) or (sec <= 600 and diff >= 4) or (sec <= 300 and diff >= 1)):
        return 'milk'
    if (q == 2 and hs <= 120) or (q == 4 and hs <= 120 and diff <= 0):
        return 'twomin'
    if q == 4 and ((sec <= 900 and diff <= -9) or (sec <= 600 and diff <= -4) or (sec <= 300 and diff < 0)):
        return 'hurry'
    return 'normal'

def load(path):
    d = pd.read_csv(path, low_memory=False)
    d = d[(d.season_type == 'REG')].copy()
    d = d[d.get('play_deleted', 0).fillna(0) == 0]
    d = d.sort_values(['game_id', 'play_id'], kind='stable').reset_index(drop=True)
    for c in ['qb_dropback', 'qb_scramble', 'sack', 'interception', 'fumble_lost', 'complete_pass', 'pass_attempt',
              'qb_kneel', 'qb_spike', 'penalty', 'timeout', 'out_of_bounds', 'touchback', 'first_down_penalty']:
        d[c] = d[c].fillna(0)
    d['ctx'] = [ctx_of(int(q) if q == q else 1, s, h, df) if p == p else 'normal'
                for q, s, h, df, p in zip(d.qtr, d.game_seconds_remaining.fillna(0), d.half_seconds_remaining.fillna(0),
                                          d.score_differential.fillna(0), d.posteam)]
    return d

def ngames(d, t):
    return d[(d.home_team == t) | (d.away_team == t)].game_id.nunique()

def final_scores(d):
    g = d.groupby('game_id').agg(h=('home_team', 'first'), a=('away_team', 'first'), hs=('home_score', 'max'),
                                 as_=('away_score', 'max'), wk=('week', 'first'))
    return g

def fit(d):
    T = {}
    teams = sorted(d.posteam.dropna().unique())
    T['teams'] = teams
    scrim = d[d.play_type.isin(['run', 'pass']) & d.posteam.notna() & d.down.notna()].copy()
    scrim['db'] = scrim.ydstogo.map(dbin)
    scrim['dropback'] = scrim.qb_dropback.astype(int)
    T['n_scrim'] = int(len(scrim))

    # ---- play calling: dropback share by (down, distance bucket, context), shrunk to parents
    base = scrim.groupby(['down', 'db']).dropback.mean()
    tab = {}
    cnt = scrim.groupby(['down', 'db', 'ctx']).dropback.agg(['sum', 'count'])
    expb = scrim.apply(lambda r: base[(r.down, r.db)], axis=1)
    delta = {c: float(scrim.dropback[scrim.ctx == c].mean() - expb[scrim.ctx == c].mean()) for c in CTXS}
    for down in (1, 2, 3, 4):
        for b in range(8):
            for c in CTXS:
                par = float(np.clip(base.get((down, b), scrim.dropback.mean()) + delta[c], .03, .97))
                s, n = (cnt.loc[(down, b, c)] if (down, b, c) in cnt.index else (0, 0))
                tab[(down, b, c)] = (s + 15 * par) / (n + 15)
    T['call'] = tab
    T['call_delta'] = delta
    scrim['pcall'] = [tab[(r, b, c)] for r, b, c in zip(scrim.down.astype(int), scrim.db, scrim.ctx)]
    T['call_off'] = {t: ridge_offset(g.dropback, g.pcall, 8.0) for t, g in scrim.groupby('posteam')}

    # ---- dropback outcomes
    dbk = scrim[scrim.dropback == 1]
    att = dbk[(dbk.sack == 0) & (dbk.qb_scramble == 0)]
    nonint = att[att.interception == 0]
    lg = {}
    lg['sack'] = dbk.sack.mean()
    lg['scr'] = dbk.qb_scramble.mean()
    lg['int'] = att.interception.mean()
    lg['comp'] = nonint.complete_pass.mean()
    nn_ = nonint[nonint.receiver_player_name.notna()]
    lg['comp_n'] = nn_.complete_pass.mean()   # completion rate on throws with a named target
    lg['throw'] = 1 - len(nn_) / len(nonint)   # throwaways (no target)
    comp = nonint[nonint.complete_pass == 1]
    lg['yac_mean'] = comp.yards_gained.mean()
    rush = scrim[(scrim.dropback == 0)]
    lg['rush_mean'] = rush.yards_gained.mean()
    lg['fl_pass'] = comp.fumble_lost.mean()
    lg['fl_rush'] = rush.fumble_lost.mean()
    lg['fl_sack'] = dbk[dbk.sack == 1].fumble_lost.mean()
    T['lg'] = lg
    lg['db_share'] = float(scrim.dropback.mean())
    rzp = scrim[scrim.yardline_100 <= 20]
    lg['rz_td'] = float(((rzp.touchdown == 1) & (rzp.td_team == rzp.posteam)).mean())   # offensive TDs per red-zone snap
    T['cal'] = {'pass': 1.0, 'rush': 1.0, 'call': 0.0, 'sigma': 0.0, 'rz': 1.0}
    T['lists'] = {
        'comp': comp.yards_gained.astype(int).tolist(),
        'rush': rush.yards_gained.astype(int).tolist(),
        'scr': dbk[dbk.qb_scramble == 1].yards_gained.astype(int).tolist(),
        'sack': dbk[dbk.sack == 1].yards_gained.astype(int).tolist(),
        'int_air': att[att.interception == 1].air_yards.fillna(8).astype(int).tolist(),
        'int_ret': att[att.interception == 1].return_yards.fillna(0).astype(int).tolist(),
    }
    fl = scrim[scrim.fumble_lost == 1]
    T['lists']['fum_ret'] = fl.fumble_recovery_1_yards.fillna(0).astype(int).tolist() or [0]

    # ---- situation tilt: zone (red zone = inside the 25, else down 1, 2, 3+) x distance bin changes sack / scramble /
    # interception rates, completion odds and the yard lists (a 3rd-and-12 is not a 1st-and-10, and a red-zone snap is
    # not an open-field one). Ratios are shrunk to 1 (n0 = 40 to 100).
    def keyed(df):
        return df.assign(sk=[skey(y, dn, t) for y, dn, t in zip(df.yardline_100, df.down, df.ydstogo)])
    sit = {}
    dbk = keyed(dbk); att = keyed(att); nonint = keyed(nonint); rush = keyed(rush)
    comp = nonint[nonint.complete_pass == 1]
    allkeys = sorted(set(dbk.sk))
    for k in SKEYS:
        a1 = dbk[dbk.sk == k]; a2 = att[att.sk == k]
        a3 = nonint[(nonint.sk == k) & nonint.receiver_player_name.notna()]
        sit[k] = dict(
            sack=shrunk(a1.sack.sum(), len(a1), lg['sack'], 40) / lg['sack'],
            scr=shrunk(a1.qb_scramble.sum(), len(a1), lg['scr'], 40) / lg['scr'],
            int=shrunk(a2.interception.sum(), len(a2), lg['int'], 100) / lg['int'],
            comp=ridge_offset(a3.complete_pass, [lg['comp_n']] * len(a3), 10.0))
    T['sit'] = sit
    # league yard lists by the same key: the situational shape every player's yards are drawn from
    cl = {k: comp[comp.sk == k].yards_gained.astype(int).tolist() for k in SKEYS}
    rl_ = {k: rush[rush.sk == k].yards_gained.astype(int).tolist() for k in SKEYS}
    # thin cells borrow the same distance class from the other zones, then the whole league
    for D in (cl, rl_):
        for k in list(D):
            if len(D[k]) < 40:
                pool = [y for kk in SKEYS if kk[1] == k[1] for y in D[kk]]
                D[k] = pool if len(pool) >= 40 else [y for kk in D for y in D[kk]]
    T['clist'], T['rlist'] = cl, rl_

    # per-team offence / defence summaries
    off, de = {}, {}
    for t in teams:
        o = {}; dd = {}
        for side, grp, store in (('o', 'posteam', o), ('d', 'defteam', dd)):
            sc = scrim[scrim[grp] == t]
            db_ = sc[sc.dropback == 1]; a = db_[(db_.sack == 0) & (db_.qb_scramble == 0)]
            ni = a[a.interception == 0]; cp = ni[ni.complete_pass == 1]
            rs = sc[sc.dropback == 0]
            store.update(n_play=len(sc), n_db=len(db_), n_sack=int(db_.sack.sum()), n_scr=int(db_.qb_scramble.sum()),
                         n_att=len(a), n_int=int(a.interception.sum()), n_ni=len(ni), n_comp=len(cp),
                         comp_yds=float(cp.yards_gained.sum()), n_rush=len(rs), rush_yds=float(rs.yards_gained.sum()),
                         epa_db=float(db_.epa.mean()) if len(db_) else 0., epa_rush=float(rs.epa.mean()) if len(rs) else 0.,
                         n_fl=int(sc.fumble_lost.sum()), n_pass_pl=len(db_), pass_rate=float(len(db_) / max(len(sc), 1)),
                         ypa=float(a.yards_gained.sum() / max(len(a), 1)), ypc=float(rs.yards_gained.mean()) if len(rs) else 0.)
            store['n_games'] = ngames(d, t)
        off[t] = o; de[t] = dd
    T['off'], T['def'] = off, de

    # ---- completion model: offsets by QB, receiver, defence (ridge logit offsets)
    pc = lg['comp_n']
    nnn = nonint[nonint.receiver_player_name.notna()]
    T['def_comp'] = {t: ridge_offset(nnn[nnn.defteam == t].complete_pass, [pc] * len(nnn[nnn.defteam == t]), 25.0) for t in teams}
    T['def_sack'] = {t: shrunk(de[t]['n_sack'], de[t]['n_db'], lg['sack'], 80) / lg['sack'] for t in teams}
    T['def_int'] = {t: shrunk(de[t]['n_int'], de[t]['n_att'], lg['int'], 250) / lg['int'] for t in teams}
    T['def_comp_y'] = {t: (de[t]['comp_yds'] + 100 * lg['yac_mean']) / (de[t]['n_comp'] + 100) / lg['yac_mean'] for t in teams}
    T['def_rush_y'] = {t: (de[t]['rush_yds'] + 100 * lg['rush_mean']) / (de[t]['n_rush'] + 100) / lg['rush_mean'] for t in teams}
    T['team_comp_y'] = {t: (off[t]['comp_yds'] + 100 * lg['yac_mean']) / (off[t]['n_comp'] + 100) / lg['yac_mean'] for t in teams}
    T['team_rush_y'] = {t: (off[t]['rush_yds'] + 100 * lg['rush_mean']) / (off[t]['n_rush'] + 100) / lg['rush_mean'] for t in teams}
    T['off_throw'] = {t: shrunk(int(((nonint.posteam == t) & nonint.receiver_player_name.isna()).sum()), off[t]['n_ni'], lg['throw'], 100) for t in teams}
    T['off_sack'] = {t: shrunk(off[t]['n_sack'], off[t]['n_db'], lg['sack'], 60) for t in teams}
    T['off_fl'] = {t: shrunk(off[t]['n_fl'], off[t]['n_play'], d_fl(scrim), 300) / d_fl(scrim) for t in teams}

    # players
    T['qb'] = {}; T['rec'] = {}; T['rush'] = {}
    for t in teams:
        db_t = dbk[dbk.posteam == t]
        if len(db_t):
            qbn = db_t.groupby('passer_player_name').size().sort_values(ascending=False)
            q1 = qbn.index[0]
        else:
            q1 = None
        a = att[att.posteam == t]
        qa = a[a.passer_player_name == q1]; qni = qa[(qa.interception == 0) & qa.receiver_player_name.notna()]
        qdb = db_t[(db_t.passer_player_name == q1) | (db_t.rusher_player_name == q1)] if q1 else db_t.iloc[0:0]   # scrambles carry the rusher's name
        T['qb'][t] = dict(
            name=q1, n_db=len(qdb), n_att=len(qa), comp_off=ridge_offset(qni.complete_pass, [pc] * len(qni), 25.0),
            int_rate=shrunk(int(qa.interception.sum()), len(qa), lg['int'], 250),
            scr_rate=shrunk(int(qdb.qb_scramble.sum()), len(qdb), lg['scr'], 60),
            scr_list=qdb[qdb.qb_scramble == 1].yards_gained.astype(int).tolist(),
            comp=int(qa.complete_pass.sum()), yds=float(qa.yards_gained.sum()), td=int(qa.touchdown.sum()),
            ints=int(qa.interception.sum()), sacks=int(qdb.sack.sum()), epa=float(qdb.epa.mean()) if len(qdb) else 0.)
        ni_t = a[(a.interception == 0) & a.receiver_player_name.notna()]
        tcr = ni_t.complete_pass.mean() if len(ni_t) else pc
        recs = []
        for key, g in a[a.receiver_player_name.notna()].groupby('receiver_player_name'):
            gn = g[g.interception == 0]
            cps = gn[gn.complete_pass == 1]
            tm = T['team_comp_y'][t] * lg['yac_mean']
            recs.append(dict(name=key, targets=len(g), n_ni=len(gn), comp=len(cps),
                             mult=(float(cps.yards_gained.sum()) + 25 * tm) / (len(cps) + 25) / lg['yac_mean'],
                             comp_off=ridge_offset(gn.complete_pass, [tcr] * len(gn), 11.0),
                             yds_list=cps.yards_gained.astype(int).tolist(), yds=float(cps.yards_gained.sum()),
                             td=int(cps.touchdown.sum()), ints=int(g.interception.sum())))
        T['rec'][t] = sorted(recs, key=lambda r: -r['targets'])
        rs = scrim[(scrim.posteam == t) & (scrim.dropback == 0)]
        rl = []
        for key, g in rs.groupby(rs.rusher_player_name.fillna('(unknown)')):
            tm = T['team_rush_y'][t] * lg['rush_mean']
            rl.append(dict(name=key, carries=len(g), mult=(float(g.yards_gained.sum()) + 40 * tm) / (len(g) + 40) / lg['rush_mean'], yds_list=g.yards_gained.astype(int).tolist(), yds=float(g.yards_gained.sum()),
                           td=int(g.touchdown.sum()), fl=int(g.fumble_lost.sum())))
        T['rush'][t] = sorted(rl, key=lambda r: -r['carries'])

    # ---- 4th-down decision table: P(go / fg / punt) by field zone and distance, shrunk toward the zone
    f4 = d[(d.down == 4) & d.play_type.isin(['run', 'pass', 'punt', 'field_goal']) & d.yardline_100.notna()].copy()
    f4['act'] = f4.play_type.map({'run': 'go', 'pass': 'go', 'punt': 'punt', 'field_goal': 'fg'})
    f4['yb'] = f4.yardline_100.map(yb); f4['db'] = f4.ydstogo.map(db)
    zone = f4.groupby('yb').act.value_counts(normalize=True).unstack(fill_value=0)
    t4 = {}
    for y in range(6):
        zp = zone.loc[y] if y in zone.index else pd.Series({'go': .3, 'fg': .3, 'punt': .4})
        for b in range(4):
            g = f4[(f4.yb == y) & (f4.db == b)]
            n = len(g)
            probs = {a: (int((g.act == a).sum()) + 6 * float(zp.get(a, 0))) / (n + 6) for a in ('go', 'fg', 'punt')}
            t4[(y, b)] = probs
    T['fourth'] = t4
    gofg = f4[f4.act == 'go']
    T['go_conv'] = float(gofg.first_down.mean()) if 'first_down' in gofg else 0.5

    # ---- field goals: logistic curve in kick distance + ridge kicker offset
    fg = d[(d.play_type == 'field_goal') & d.kick_distance.notna()].copy()
    fg['y'] = (fg.field_goal_result == 'made').astype(int)
    X = np.c_[np.ones(len(fg)), fg.kick_distance.values - 40.0]
    w = np.zeros(2)
    for _ in range(25):
        p = 1 / (1 + np.exp(-X @ w))
        H = X.T @ (X * (p * (1 - p))[:, None]) + np.eye(2) * 1e-3
        w = w + np.linalg.solve(H, X.T @ (fg.y.values - p))
    T['fg_w'] = [float(w[0]), float(w[1])]
    fg['pe'] = 1 / (1 + np.exp(-(w[0] + w[1] * (fg.kick_distance - 40.0))))
    T['kicker'] = {}
    for t, g in fg.groupby('posteam'):
        k = g.kicker_player_name.value_counts().index[0]
        gk = g[g.kicker_player_name == k]
        T['kicker'][t] = dict(name=k, att=len(gk), made=int(gk.y.sum()), off=ridge_offset(gk.y, gk.pe, 6.0))
    T['xp'] = float((d.extra_point_result == 'good').sum() / d.extra_point_result.notna().sum())
    tp = d[d.two_point_conv_result.notna()]
    T['two'] = float((tp.two_point_conv_result == 'success').mean())
    T['n_fg'] = int(len(fg)); T['n_xp'] = int(d.extra_point_result.notna().sum()); T['n_2pt'] = int(len(tp))

    # ---- punts (distance, return, touchback) mixture
    pu = d[(d.play_type == 'punt') & d.kick_distance.notna() & d.posteam.notna()]
    def pun(g):
        return [(int(r.kick_distance), int(r.return_yards) if r.return_yards == r.return_yards else 0, int(r.touchback))
                for r in g.itertuples()]
    T['punts_lg'] = pun(pu)
    T['punter'] = {t: dict(name=(g.punter_player_name.value_counts().index[0] if g.punter_player_name.notna().any() else None),
                           list=pun(g), n=len(g)) for t, g in pu.groupby('posteam')}

    # ---- kickoff start (first scrimmage play of a drive that began on a kickoff)
    st = d[d.drive_start_transition.eq('KICKOFF') & d.down.notna() & d.yardline_100.notna() & d.play_type.isin(['run', 'pass'])]
    ks = st.groupby(['game_id', 'drive']).yardline_100.first()
    T['kick_start'] = ks.astype(int).tolist()

    # ---- penalties (scrimmage downs, accepted: no_play rows)
    pen = d[(d.penalty == 1) & d.penalty_team.notna() & d.posteam.notna() & d.down.notna() & (d.play_type == 'no_play')]
    pen_o = pen[pen.penalty_team == pen.posteam]; pen_d = pen[pen.penalty_team == pen.defteam]
    nsc = len(scrim) + len(pen)
    T['lg_pen_o'] = len(pen_o) / nsc; T['lg_pen_d'] = len(pen_d) / nsc
    T['pen_yds_o'] = pen_o.penalty_yards.abs().fillna(5).astype(int).tolist()
    T['pen_yds_d'] = pen_d.penalty_yards.abs().fillna(5).astype(int).tolist()
    T['pen_auto'] = float(pen_d.first_down_penalty.mean())
    npl = {t: len(scrim[scrim.posteam == t]) for t in teams}
    npd = {t: len(scrim[scrim.defteam == t]) for t in teams}
    T['pen_off'] = {t: shrunk(len(pen_o[pen_o.posteam == t]), npl[t], T['lg_pen_o'], 150) / T['lg_pen_o'] for t in teams}
    T['pen_def'] = {t: shrunk(len(pen_d[pen_d.defteam == t]), npd[t], T['lg_pen_d'], 150) / T['lg_pen_d'] for t in teams}

    # ---- clock: seconds from one snap to the next, by play class and context
    # timeout rows are skipped when looking for the next snap, so a play followed by a timeout counts only the clock
    # that actually ran (the sim has no timeouts; this is how their effect on plays per game enters)
    e = d[d.play_type.notna() & (d.timeout == 0) & (d.posteam.notna() | (d.play_type == 'kickoff'))].copy()
    g = e.groupby('game_id')
    e['n_sec'] = g.game_seconds_remaining.shift(-1); e['n_q'] = g.qtr.shift(-1); e['n_type'] = g.play_type.shift(-1)
    e['dt'] = e.game_seconds_remaining - e.n_sec
    ok = e.dt.between(0, 60) & (e.n_q == e.qtr) & e.n_type.isin(['run', 'pass', 'no_play', 'qb_kneel', 'qb_spike', 'punt', 'field_goal', 'extra_point', 'kickoff'])
    d = e
    def cls(r):
        if r.play_type == 'kickoff':
            return 'kick' if r.n_type in ('run', 'pass') else None
        if r.n_type in ('extra_point', 'kickoff') and r.play_type != 'field_goal':
            return 'td' if r.play_type in ('run', 'pass') and r.touchdown == 1 else None
        if r.play_type in ('run', 'pass') and r.touchdown == 1:
            return None
        if r.play_type == 'no_play':
            return 'pen' if r.penalty == 1 else None
        if r.play_type == 'punt': return 'punt'
        if r.play_type == 'field_goal': return 'fg'
        if r.play_type == 'qb_kneel': return 'kneel'
        if r.play_type not in ('run', 'pass'): return None
        if r.sack == 1: return 'sack'
        if r.qb_scramble == 1: return 'scr'
        if r.play_type == 'pass': return 'comp' if r.complete_pass == 1 else 'inc'
        return 'run'
    dd_ = d[ok].copy()
    dd_['cls'] = [cls(r) for r in dd_.itertuples()]
    dd_ = dd_[dd_.cls.notna()]
    el = {}
    for (c, cx), g2 in dd_.groupby(['cls', 'ctx']):
        el[(c, cx)] = g2.dt.astype(int).tolist()
    for c in set(k[0] for k in el):
        for cx in CTXS:
            if len(el.get((c, cx), [])) < 25:
                el[(c, cx)] = el.get((c, 'normal'), []) or el[(c, [k[1] for k in el if k[0] == c][0])]
    T['elapsed'] = el
    T['n_elapsed'] = int(len(dd_))
    return T

def d_fl(scrim):
    return float(scrim.fumble_lost.mean())

def team_results(d):
    g = final_scores(d)
    out = {}
    for t in sorted(d.posteam.dropna().unique()):
        pf, pa = [], []
        for r in g.itertuples():
            if r.h == t: pf.append(r.hs); pa.append(r.as_)
            elif r.a == t: pf.append(r.as_); pa.append(r.hs)
        out[t] = dict(games=len(pf), ppg=float(np.mean(pf)), papg=float(np.mean(pa)))
    return out
