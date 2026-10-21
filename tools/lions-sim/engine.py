"""Play-level Monte Carlo of one NFL game. Positions are yards to the offence's goal line ("yl", 100 = own goal line);
the log converts to a fixed field (x = 0 is team 0's goal line, team 0 attacks toward x = 100)."""
import math
import random
from fit import sig, logit, db, dbin, yb, ctx_of, skey

KICK = 'KICK'

def mix(rng, own, n, k, fallback, scale=1.0, pos_only=False):
    """Draw from the player's own list with prob n/(n+k), else from the (team-scaled) league list."""
    if own and rng.random() < n / (n + k):
        return own[int(rng.random() * len(own))]
    y = fallback[int(rng.random() * len(fallback))]
    if scale != 1.0 and y > 0:
        v = y * scale
        y = int(v) + (1 if rng.random() < v - int(v) else 0)
    return y

class Matchup:
    """Everything about team O's offence facing team D's defence, precomputed once."""
    def __init__(s, T, O, D):
        lg = T['lg']; s.O, s.D = O, D
        s.call = {k: min(max(sig(logit(p) + T['call_off'][O] + T['cal']['call']), .02), .98) for k, p in T['call'].items()}
        s.qb = T['qb'][O]
        s.p_sack = min(T['off_sack'][O] * T['def_sack'][D], .25)
        s.p_scr = s.qb['scr_rate']
        s.p_int = min(s.qb['int_rate'] * T['def_int'][D], .12)
        s.comp_base = logit(lg['comp_n']) + s.qb['comp_off'] + T['def_comp'][D]
        s.f_def_comp = T['def_comp_y'][D]; s.f_def_rush = T['def_rush_y'][D]
        s.f_team_comp = T['team_comp_y'][O]; s.f_team_rush = T['team_rush_y'][O]
        recs = T['rec'][O]
        s.rec = recs; s.rec_w = [r['targets'] for r in recs]; s.rec_tot = float(sum(s.rec_w))
        s.rec_cum = []; c = 0
        for w in s.rec_w:
            c += w; s.rec_cum.append(c)
        s.rec_p = [sig(s.comp_base + r['comp_off']) for r in recs]
        rs = T['rush'][O]
        s.rs = rs; c = 0; s.rs_cum = []
        for r in rs:
            c += r['carries']; s.rs_cum.append(c)
        s.rs_tot = c
        s.p_throw = T['off_throw'][O]
        s.fl = T['off_fl'][O]
        s.pen_o = T['lg_pen_o'] * T['pen_off'][O]; s.pen_d = T['lg_pen_d'] * T['pen_def'][D]
        k = T['kicker'].get(O)
        s.kick_off = k['off'] if k else 0.0; s.kicker = k['name'] if k else 'K'
        pu = T['punter'].get(O)
        s.punts = pu['list'] if pu else []; s.punter = (pu['name'] if pu and pu['name'] else 'P')
        s.qbname = s.qb['name'] or 'QB'

def pick(cum, tot, rng):
    r = rng.random() * tot
    lo, hi = 0, len(cum) - 1
    while lo < hi:
        m = (lo + hi) // 2
        if cum[m] > r: hi = m
        else: lo = m + 1
    return lo

def clock_txt(sec, ot):
    if ot:
        return 'OT', int(sec)
    q = 4 - (int(sec) - 1) // 900 if sec >= 1 else 4
    return q, int(sec - 900 * (4 - q))

class Game:
    def __init__(s, T, M, rng, names, log=False):
        s.T, s.M, s.rng, s.names, s.log = T, M, rng, names, log
        s.lg = T['lg']; s.L = T['lists']

    # ---- helpers
    def elapsed(s, cls, ctx):
        l = s.T['elapsed'].get((cls, ctx)) or s.T['elapsed'].get((cls, 'normal'))
        return l[int(s.rng.random() * len(l))]

    def ctx(s, o):
        diff = s.score[o] - s.score[1 - o]
        if s.ot: return 'normal'
        sec = s.clock
        q = 4 - (int(sec) - 1) // 900 if sec >= 1 else 4
        hs = sec - 1800 if sec > 1800 else sec
        return ctx_of(q, sec, hs, diff)

    def x(s, o, yl):
        return 100 - yl if o == 0 else yl

    def kick_start(s):
        l = s.T['kick_start']
        return l[int(s.rng.random() * len(l))]

    def emit(s, o, d, g, yl0, yl1, kind, text, yds=0, fd=None, key=None):
        if not s.log: return
        q, c = clock_txt(s.clock, s.ot)
        s.cur['plays'].append(dict(q=q, c=c, o=o, d=d, g=g, x0=s.x(o, yl0), x1=s.x(o, yl1), k=kind, tx=text, y=yds,
                                   fd=(s.x(o, fd) if fd is not None else None), sc=list(s.score)))

    # ---- scoring after touchdown
    def after_td(s, t):
        rng = s.rng; T = s.T
        m = s.score[t] - s.score[1 - t]
        q = 5 if s.ot else (4 - (int(s.clock) - 1) // 900 if s.clock >= 1 else 4)
        # the six points are already on the board: go for two only when it ties a two-point game late
        two = (q in (4, 5) and m == -2)
        if two:
            ok = rng.random() < T['two']
            if ok: s.score[t] += 2
            s.st[t]['two'] += 1
            return ('2-pt conversion good' if ok else '2-pt conversion fails')
        ok = rng.random() < T['xp']
        if ok: s.score[t] += 1
        return 'extra point good' if ok else 'extra point no good'

    def run(s):
        rng, T, M = s.rng, s.T, s.M
        s.score = [0, 0]; s.ot = False; s.clock = 3600.0
        s.st = [dict(plays=0, yds=0, pass_yds=0, rush_yds=0, tov=0, fd=0, att=0, comp=0, rush=0, sacks=0, drives=0,
                     fg=0, fga=0, punts=0, pen=0, two=0, td=0, pass_yds_c=0, comp_n=0, ry=0, rn=0, dbk=0, sp=0, rzp=0, rztd=0) for _ in range(2)]
        s.drives = []
        sg = T['cal']['sigma']
        s.form = [math.exp(sg * rng.gauss(0, 1)) for _ in (0, 1)]   # each offence's yardage form on the day
        first = int(rng.random() * 2); s.recv2 = 1 - first
        s.half = 1; poss = first; yl = s.kick_start()
        s.k_note(1 - first, 'Kickoff')
        ot_n = 0; kick = True
        while True:
            r = s.drive(poss, yl, len(s.drives) + 1, kick)
            kind, nxt, nyl = r
            if s.ot:
                ot_n += 1
                if s.score[0] != s.score[1] and (ot_n >= 2 or (s.score[poss] < s.score[1 - poss])):
                    break
                if s.clock <= 0: break
            if kind == 'end':
                if s.ot or s.score[0] != s.score[1]: break
                # tie after regulation: overtime, coin toss
                s.ot = True; s.clock = 600.0; ot_n = 0
                poss = int(rng.random() * 2); yl = s.kick_start()
                s.k_note(1 - poss, 'Overtime kickoff'); kick = True
                continue
            if kind == 'half':
                s.half = 2; s.clock = 1800.0; poss = s.recv2; yl = s.kick_start()
                s.k_note(1 - poss, 'Second-half kickoff'); kick = True; continue
            poss, yl = nxt, nyl; kick = kind in ('td', 'fg', 'safety', 'deftd')
            # a score ended exactly as time ran out
            if not s.ot:
                if s.half == 1 and s.clock <= 1800:
                    s.half = 2; s.clock = 1800.0; poss = s.recv2; yl = s.kick_start()
                    s.k_note(1 - poss, 'Second-half kickoff'); kick = True
                elif s.clock <= 0:
                    if s.score[0] != s.score[1]: break
                    s.ot = True; s.clock = 600.0; ot_n = 0
                    poss = int(rng.random() * 2); yl = s.kick_start()
                    s.k_note(1 - poss, 'Overtime kickoff'); kick = True
        return s.score, s.st

    def k_note(s, kicker, text):
        if s.log:
            s.pending_kick = (kicker, text)

    # ---- a drive
    def drive(s, o, yl, n, kick=False):
        rng, T = s.rng, s.T; M = s.M[o]; Dm = s.M[1 - o]; st = s.st[o]
        st['drives'] += 1
        if kick: s.clock -= s.elapsed('kick', s.ctx(o))
        s.cur = dict(n=n, o=o, plays=[])
        if s.log:
            q, c = clock_txt(s.clock, s.ot)
            s.cur.update(q=q, c=c, x0=s.x(o, yl), pk=getattr(s, 'pending_kick', None))
            s.pending_kick = None
        t0 = s.clock; ys0 = st['yds']; d = 1; togo = min(10, yl); nplays = 0; first_down_line = yl - togo
        res = None
        while True:
            ctxv = s.ctx(o)
            diff = s.score[o] - s.score[1 - o]
            q = 5 if s.ot else (4 - (int(s.clock) - 1) // 900 if s.clock >= 1 else 4)
            # ---- kneel to run out the game
            if q == 4 and diff > 0 and not s.ot and s.clock <= {1: 125, 2: 85, 3: 45, 4: 40}[d]:
                yl0 = yl; yl = min(yl + 1, 99); s.clock -= 40
                nplays += 1; st['plays'] += 1; st['yds'] -= 1; st['rush_yds'] -= 1; st['rush'] += 1
                s.emit(o, d, togo, yl0, yl, 'run', f"{M.qbname} kneels", -1, first_down_line)
                if s.clock <= 0:
                    res = ('end', 1 - o, 80); break
                d += 1; togo += 1
                if d == 5:
                    res = ('downs', 1 - o, 100 - yl); break
                continue
            # ---- fourth down
            if d == 4:
                act = s.fourth(o, yl, togo, diff, q, s.clock)
                if act == 'fg':
                    s.clock -= s.elapsed('fg', ctxv)
                    res = s.field_goal(o, M, st, d, togo, yl); break
                if act == 'punt':
                    s.clock -= s.elapsed('punt', ctxv); st['punts'] += 1
                    kd, ret, tb = s.punt_sample(M)
                    if kd <= 0:
                        s.emit(o, d, togo, yl, yl, 'punt', f"{M.punter} punt is blocked", 0, None)
                        res = ('punt', 1 - o, 100 - yl); break
                    land = yl - kd
                    if land <= 0 or (tb and land <= 10):
                        ny = 80; txt = f"{M.punter} punts {kd} yards, touchback"
                    else:
                        ny = 100 - land - ret
                        txt = f"{M.punter} punts {kd} yards" + (f", returned {ret} yards" if ret else ", fair catch / downed")
                        if ny <= 0:
                            txt += " for a touchdown"
                    if ny <= 0:
                        # return touchdown
                        rt = 1 - o
                        s.score[rt] += 6
                        s.emit(o, d, togo, yl, 0, 'punt', txt, 0, None)
                        s.st[rt]['td'] += 1
                        s.emit(rt, 0, 0, 0, 0, 'pat', s.after_td(rt), 0)
                        res = ('deftd', o, s.kick_start()); break
                    s.emit(o, d, togo, yl, max(land, 0), 'punt', txt, kd, None)
                    res = ('punt', 1 - o, ny); break
            # ---- penalties before the snap
            r = rng.random()
            if r < M.pen_o + Dm.pen_d:
                if r < M.pen_o:
                    yds = T['pen_yds_o'][int(rng.random() * len(T['pen_yds_o']))]
                    yds = min(yds, (100 - yl) // 2)
                    s.clock -= s.elapsed('pen', ctxv)
                    yl0 = yl; yl += yds; togo += yds; st['pen'] += 1
                    s.emit(o, d, togo - yds, yl0, yl, 'pen', f"PENALTY on {s.names[o]}, offense, {yds} yards", -yds, yl - togo)
                else:
                    yds = T['pen_yds_d'][int(rng.random() * len(T['pen_yds_d']))]
                    yds = min(yds, yl // 2) if yl > 1 else 0
                    s.clock -= s.elapsed('pen', ctxv)
                    yl0 = yl; yl -= yds; s.st[1 - o]['pen'] += 1
                    auto = rng.random() < T['pen_auto']
                    s.emit(o, d, togo, yl0, yl, 'pen', f"PENALTY on {s.names[1 - o]}, defense, {yds} yards" + (", automatic first down" if auto or yds >= togo else ""), yds, None)
                    if yds >= togo or auto:
                        st['fd'] += 1; d = 1; togo = min(10, yl); first_down_line = yl - togo
                    else:
                        togo -= yds
                if s.clock <= (1800 if s.half == 1 and not s.ot else 0):
                    res = ('half' if s.half == 1 and not s.ot else 'end', 1 - o, 80); break
                continue
            # ---- scrimmage play
            dropback = rng.random() < M.call[(d, dbin(togo), ctxv)]
            yl0 = yl; d0 = d; g0 = togo; tov = None
            st['sp'] += 1; st['dbk'] += dropback; st['rzp'] += (yl <= 20)
            sk = skey(yl, d, togo)
            sit = T['sit'][sk]
            if dropback:
                r = rng.random()
                p_sack = M.p_sack * sit['sack']; p_scr = M.p_scr * sit['scr']
                if r < p_sack:
                    yds = s.L['sack'][int(rng.random() * len(s.L['sack']))]
                    st['sacks'] += 1; cls_ = 'sack'
                    txt = f"{M.qbname} sacked for a loss of {-yds} yards"; kind = 'sack'
                    fum = rng.random() < s.lg['fl_sack'] * M.fl
                    pass_yd = yds
                elif r < p_sack + p_scr:
                    yds = mix(rng, M.qb['scr_list'], len(M.qb['scr_list']), 20, s.L['scr'])
                    cls_ = 'scr'; kind = 'run'
                    txt = f"{M.qbname} scrambles for {yds} yards"; st['rush'] += 1
                    fum = rng.random() < s.lg['fl_rush'] * M.fl
                    pass_yd = 0
                else:
                    st['att'] += 1
                    if rng.random() < M.p_int * sit['int']:
                        ay = s.L['int_air'][int(rng.random() * len(s.L['int_air']))]
                        rec = M.rec[pick(M.rec_cum, M.rec_tot, rng)]['name']
                        spot = yl - max(ay, 1)
                        tov = ('int', spot, s.L['int_ret'][int(rng.random() * len(s.L['int_ret']))])
                        yds = 0; cls_ = 'inc'; kind = 'int'; fum = False; pass_yd = 0
                        txt = f"{M.qbname} pass INTERCEPTED"
                    else:
                        i = pick(M.rec_cum, M.rec_tot, rng); R = M.rec[i]
                        if rng.random() < M.p_throw:
                            yds = 0; cls_ = 'inc'; kind = 'inc'; fum = False; pass_yd = 0
                            txt = f"{M.qbname} pass incomplete, thrown away"
                        elif rng.random() < sig(logit(M.rec_p[i]) + sit['comp']):
                            lst = T['clist'][sk]
                            yds = lst[int(rng.random() * len(lst))]
                            if yds > 0:
                                v = yds * R['mult'] * M.f_def_comp * T['cal']['pass'] * s.form[o] * (T['cal']['rz'] if yl <= 20 else 1.0)
                                yds = int(v) + (1 if rng.random() < v - int(v) else 0)
                            cls_ = 'comp'; kind = 'pass'; st['comp'] += 1; st['comp_n'] += 1; st['pass_yds_c'] += min(yds, yl)
                            txt = f"{M.qbname} pass complete to {R['name']} for {yds} yards"
                            fum = rng.random() < s.lg['fl_pass'] * M.fl
                            pass_yd = yds
                        else:
                            yds = 0; cls_ = 'inc'; kind = 'inc'; fum = False; pass_yd = 0
                            txt = f"{M.qbname} pass incomplete intended for {R['name']}"
            else:
                R = M.rs[pick(M.rs_cum, M.rs_tot, rng)]
                lst = T['rlist'][sk]
                yds = lst[int(rng.random() * len(lst))]
                if yds > 0:
                    v = yds * R['mult'] * M.f_def_rush * T['cal']['rush'] * s.form[o] * (T['cal']['rz'] if yl <= 20 else 1.0)
                    yds = int(v) + (1 if rng.random() < v - int(v) else 0)
                cls_ = 'run'; kind = 'run'; st['rush'] += 1; st['rn'] += 1; st['ry'] += min(yds, yl)
                txt = f"{R['name']} rush for {yds} yards" if yds >= 0 else f"{R['name']} rush for a loss of {-yds} yards"
                fum = rng.random() < s.lg['fl_rush'] * M.fl
                pass_yd = 0
            el = s.elapsed(cls_, ctxv); s.clock -= el
            st['plays'] += 1
            if tov and tov[0] == 'int':
                st['tov'] += 1
                spot, ret = tov[1], tov[2]
                if spot <= 0:
                    ny = 80; txt += " in the end zone, touchback"
                else:
                    ny = 100 - spot - ret
                    txt += f", returned {ret} yards"
                if ny <= 0:
                    s.score[1 - o] += 6; s.st[1 - o]['td'] += 1
                    s.emit(o, d0, g0, yl0, max(spot, 0), 'int', txt + " for a touchdown", 0, None)
                    s.emit(1 - o, 0, 0, 0, 0, 'pat', s.after_td(1 - o), 0)
                    res = ('deftd', o, s.kick_start()); break
                s.emit(o, d0, g0, yl0, max(spot, 0), 'int', txt, 0, None)
                res = ('to', 1 - o, ny); break
            # apply yards (a gain past the goal line stops at it)
            if yds > yl: yds = yl   # (stats stop at the goal line)
            if pass_yd > yds: pass_yd = yds
            new = yl - yds
            if new >= 100:
                # safety
                s.score[1 - o] += 2
                s.emit(o, d0, g0, yl0, 100, kind, txt + " in the end zone: SAFETY", yds, None)
                res = ('safety', 1 - o, s.kick_start()); break
            if fum and new > 0:
                st['tov'] += 1
                ret = s.L['fum_ret'][int(rng.random() * len(s.L['fum_ret']))]
                ny = 100 - new - max(min(ret, 30), 0)
                st['yds'] += yds; st['pass_yds'] += pass_yd; st['rush_yds'] += (yds - pass_yd)
                if ny <= 0:
                    s.score[1 - o] += 6; s.st[1 - o]['td'] += 1
                    s.emit(o, d0, g0, yl0, max(new, 1), kind, txt + ", FUMBLE lost, returned for a touchdown", yds, None)
                    s.emit(1 - o, 0, 0, 0, 0, 'pat', s.after_td(1 - o), 0)
                    res = ('deftd', o, s.kick_start()); break
                s.emit(o, d0, g0, yl0, max(new, 1), kind, txt + ", FUMBLE lost", yds, None)
                res = ('to', 1 - o, ny); break
            yl = new
            st['yds'] += yds; st['pass_yds'] += pass_yd; st['rush_yds'] += (yds - pass_yd)
            if yl <= 0:
                s.score[o] += 6; st['td'] += 1
                s.clock += el - s.elapsed('td', ctxv)
                st['rztd'] += (yl0 <= 20)
                s.emit(o, d0, g0, yl0, 0, kind, txt + " TOUCHDOWN", yds, None)
                s.emit(o, 0, 0, 0, 0, 'pat', s.after_td(o), 0)
                res = ('td', 1 - o, s.kick_start()); break
            gain = yl0 - yl
            if gain >= togo:
                st['fd'] += 1; d = 1; togo = min(10, yl); first_down_line = yl - togo
                s.emit(o, d0, g0, yl0, yl, kind, txt + ", first down", yds, first_down_line)
            else:
                s.emit(o, d0, g0, yl0, yl, kind, txt, yds, first_down_line)
                if d == 4:
                    res = ('downs', 1 - o, 100 - yl); break
                d += 1; togo -= gain
            nplays += 1
            lim = 1800 if (s.half == 1 and not s.ot) else 0
            if s.clock <= lim:
                res = s.last_second_fg(o, M, st, d, togo, yl) if lim or not s.ot else None
                if res is None: res = ('half' if lim else 'end', 1 - o, 80)
                elif res[0] == 'fg': res = ('fg', 1 - o, res[2])
                break
        # drive over: bookkeeping
        kind = res[0]
        if kind == 'end':
            s.clock = max(s.clock, 0.0)
        if s.log:
            q, c = clock_txt(s.clock, s.ot)
            names = dict(td='Touchdown', fg='Field goal', fgmiss='Missed FG', punt='Punt', to='Turnover', downs='Turnover on downs',
                         half='End of half', end='End of game', safety='Safety', deftd='Turnover, returned for TD')
            s.cur['res'] = names.get(kind, kind)
            s.cur['rk'] = kind
            s.cur['qe'] = q; s.cur['ce'] = c
            s.cur['secs'] = int(t0 - s.clock)
            s.cur['pl'] = len([p for p in s.cur['plays'] if p['k'] not in ('pat', 'pen')])
            s.cur['yds'] = int(st['yds'] - ys0)
            s.cur['sc'] = list(s.score)
            s.drives.append(s.cur)
        else:
            s.drives.append(None)
        # first-half clock floor
        if kind == 'half':
            s.clock = 1800.0
        return res

    def field_goal(s, o, M, st, d, togo, yl):
        T = s.T; dist = yl + 17
        p = sig(T['fg_w'][0] + T['fg_w'][1] * (dist - 40) + M.kick_off)
        st['fga'] += 1
        if s.rng.random() < p:
            s.score[o] += 3; st['fg'] += 1
            s.emit(o, d, togo, yl, 0, 'fg', f"{M.kicker} {dist}-yard field goal is GOOD", 0, None)
            return ('fg', 1 - o, s.kick_start())
        s.emit(o, d, togo, yl, yl, 'fgmiss', f"{M.kicker} {dist}-yard field goal is NO GOOD", 0, None)
        return ('fgmiss', 1 - o, min(80, 100 - (yl + 7)))

    def last_second_fg(s, o, M, st, d, togo, yl):
        """Time ran out with the ball in field-goal range: the offence is assumed to have spiked or used a timeout and gets
        one try at the end of the first half, or at the end of a game it is tied or trailing by up to three in."""
        if yl > 37 or s.ot: return None
        diff = s.score[o] - s.score[1 - o]
        if s.half == 1 or -3 <= diff <= 0:
            return s.field_goal(o, M, st, d, togo, yl)
        return None

    def punt_sample(s, M):
        rng = s.rng; T = s.T
        own = M.punts
        if own and rng.random() < len(own) / (len(own) + 15):
            return own[int(rng.random() * len(own))]
        l = T['punts_lg']
        return l[int(rng.random() * len(l))]

    def fourth(s, o, yl, togo, diff, q, sec):
        rng = s.rng; T = s.T
        p = T['fourth'][(yb(yl), db(togo))]
        late = (q in (4, 5)) and sec <= 300 and diff < 0 and not s.ot
        if late:
            if yl <= 37 and diff >= -3: return 'fg'
            return 'go'
        if s.ot and yl <= 37 and diff <= 0 and s.clock < 120: return 'fg'
        r = rng.random()
        act = 'go' if r < p['go'] else 'fg' if r < p['go'] + p['fg'] else 'punt'
        if act == 'fg' and yl > 52: act = 'punt'
        return act
