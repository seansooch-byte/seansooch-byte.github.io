/* Base-rate risk trainer.
   Pure functions are exported for the node test. This file does not load fixtures.json. */
(function (root) {
  var SCORE_KEY = 'drills.base-rates.sessionScore';
  var STEPS = 10000;
  var P_MIN = 0.001;
  var P_MAX = 0.5;
  var STOPS = [0.001, 0.01, 0.1, 0.5];
  var ASSUMPTION = 'NNT assumes the action helps only patients who would have had the event, at this fixed fictional RRR, and harms no one.';

  function noPositives(se, sp, p) {
    return (se === 0 || p === 0) && (sp === 1 || p === 1);
  }

  function noNegatives(se, sp, p) {
    return (sp === 0 || p === 1) && (se === 1 || p === 0);
  }

  function tidyRatio(x) {
    if (x > 1 && x < 1 + 1e-9) return 1;
    if (x < 0 && x > -1e-9) return 0;
    return x;
  }

  function compute(se, sp, p, rrr) {
    var tpMass = se * p;
    var fpMass = (1 - sp) * (1 - p);
    var fnMass = (1 - se) * p;
    var tnMass = sp * (1 - p);
    var positives = tpMass + fpMass;
    var negatives = tnMass + fnMass;
    var ppv = null;
    var npv = null;
    if (!noPositives(se, sp, p) && positives > 0) ppv = tidyRatio(tpMass / positives);
    if (!noNegatives(se, sp, p) && negatives > 0) npv = tidyRatio(tnMass / negatives);
    var nne = ppv !== null && ppv > 0 ? 1 / ppv : null;
    var nnt = ppv !== null && ppv > 0 && rrr > 0 ? 1 / (ppv * rrr) : null;
    return {
      ppv: ppv,
      npv: npv,
      nne: nne,
      nnt: nnt,
      riskFlagged: ppv,
      riskClear: npv === null ? null : tidyRatio(1 - npv)
    };
  }

  function formatPercent(x) {
    if (x === null || x === undefined) return 'Undefined';
    if (!(typeof x === 'number') || !Number.isFinite(x)) return 'Undefined';
    if (x > 0 && x < 1 && Math.round(x * 1000) / 10 >= 100) return '>99.9%';
    if (x > 0 && x < 0.0005) return '<0.1%';
    var tenths = Math.round(x * 1000) / 10;
    if (tenths <= 0 && x > 0) return '<0.1%';
    if (Math.abs(tenths - Math.round(tenths)) < 1e-9) return String(Math.round(tenths)) + '%';
    return tenths.toFixed(1) + '%';
  }

  function formatBurden(x) {
    if (x === null || x === undefined) return 'Undefined';
    if (!(typeof x === 'number') || !Number.isFinite(x)) return 'Undefined';
    var tenths = Math.round(x * 10) / 10;
    if (tenths >= 10) return String(Math.round(x));
    return tenths.toFixed(1);
  }

  function formatPrevalence(p) {
    var pct = p * 100;
    var places = pct >= 1 ? 10 : 100;
    var rounded = Math.round(pct * places) / places;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded)) + '%';
    var text = rounded.toFixed(pct >= 1 ? 1 : 2);
    return text.replace(/0+$/, '').replace(/\.$/, '') + '%';
  }

  function rawPrevalence(index) {
    var t = Number(index) / STEPS;
    if (t <= 0) return P_MIN;
    if (t >= 1) return P_MAX;
    return P_MIN * Math.pow(P_MAX / P_MIN, t);
  }

  function prevalenceFromSlider(index) {
    var raw = rawPrevalence(index);
    var best = STOPS[0];
    var bestDist = Infinity;
    for (var i = 0; i < STOPS.length; i++) {
      var dist = Math.abs(Math.log(raw) - Math.log(STOPS[i]));
      if (dist < bestDist) {
        bestDist = dist;
        best = STOPS[i];
      }
    }
    var half = Math.log(P_MAX / P_MIN) / STEPS / 2;
    if (bestDist <= half + 1e-12) return best;
    return raw;
  }

  function sliderIndexForPrevalence(p) {
    if (p <= P_MIN) return 0;
    if (p >= P_MAX) return STEPS;
    var t = Math.log(p / P_MIN) / Math.log(P_MAX / P_MIN);
    return Math.round(Math.min(STEPS, Math.max(0, t * STEPS)));
  }

  function countsPerThousand(se, sp, p) {
    var rates = [se * p, (1 - se) * p, (1 - sp) * (1 - p), sp * (1 - p)];
    var keys = ['tp', 'fn', 'fp', 'tn'];
    var expected = {
      tp: rates[0] * 1000,
      fn: rates[1] * 1000,
      fp: rates[2] * 1000,
      tn: rates[3] * 1000
    };
    var SCALE = 1000000;
    var scaled = rates.map(function (rate) { return Math.round(rate * 1000 * SCALE); });
    var sumScaled = scaled.reduce(function (a, b) { return a + b; }, 0);
    var drift = 1000 * SCALE - sumScaled;
    if (drift !== 0 && Math.abs(drift) <= 1000) {
      var idx = 0;
      for (var i = 1; i < scaled.length; i++) if (scaled[i] > scaled[idx]) idx = i;
      scaled[idx] += drift;
    }
    var base = scaled.map(function (m) { return Math.floor(m / SCALE); });
    var rem = scaled.map(function (m, n) { return m - base[n] * SCALE; });
    var left = 1000 - base.reduce(function (a, b) { return a + b; }, 0);
    var order = [0, 1, 2, 3].sort(function (a, b) { return (rem[b] - rem[a]) || (a - b); });
    var n = base.slice();
    var guard = 0;
    while (left > 0 && guard < 20) {
      for (var k = 0; k < order.length && left > 0; k++) {
        n[order[k]] += 1;
        left -= 1;
      }
      guard += 1;
    }
    var counts = { tp: n[0], fn: n[1], fp: n[2], tn: n[3] };
    var fractional = keys.some(function (key) {
      return Math.abs(expected[key] - Math.round(expected[key])) > 1e-6;
    });
    return { counts: counts, expected: expected, fractional: fractional };
  }

  function kindsFromCounts(counts) {
    var kinds = [];
    var groups = [['tp', counts.tp], ['fp', counts.fp], ['fn', counts.fn], ['tn', counts.tn]];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g][1]; i++) kinds.push(groups[g][0]);
    }
    return kinds;
  }

  function iconSummary(counts) {
    return '1000 fictional patients: ' + counts.tp + ' true alerts, ' + counts.fp +
      ' false alerts, ' + counts.fn + ' missed cases, ' + counts.tn +
      ' with no alert and no condition.';
  }

  function notesFor(sp, metrics) {
    var notes = [];
    if (metrics.ppv === null) {
      notes.push('PPV is undefined. This threshold flags nobody, so there are no positive results. A percent, including 100%, would be misleading.');
    } else if (metrics.ppv === 0) {
      notes.push('PPV is 0%. Alerts happen, but none of them are true cases. NNE and NNT are undefined because the denominator would be zero.');
    } else if (sp === 1 && metrics.ppv === 1) {
      notes.push('Specificity is 100% in this fictional model, so there are no false alerts. Every alert is a true case, and PPV is 100%.');
    }
    if (metrics.npv === null) {
      notes.push('NPV is undefined. This threshold clears nobody, so there are no negative results.');
    }
    return notes;
  }

  function roundingNote(fractional) {
    if (!fractional) return null;
    return 'These 1,000 icons and the table are whole patients. The exact expected counts were not all whole numbers, so the cells are the nearest whole split that still sums to 1,000. PPV, NPV, NNE and NNT use the exact formulas, not these rounded cells.';
  }

  function viewModel(se, sp, p, rrr) {
    var metrics = compute(se, sp, p, rrr);
    var split = countsPerThousand(se, sp, p);
    var text = {
      ppv: formatPercent(metrics.ppv),
      npv: formatPercent(metrics.npv),
      nne: formatBurden(metrics.nne),
      nnt: formatBurden(metrics.nnt),
      riskFlagged: formatPercent(metrics.riskFlagged),
      riskClear: formatPercent(metrics.riskClear),
      prevalence: formatPrevalence(p)
    };
    return {
      metrics: metrics,
      text: text,
      notes: notesFor(sp, metrics),
      assumption: ASSUMPTION,
      roundingNote: roundingNote(split.fractional),
      counts: split.counts,
      expected: split.expected,
      fractional: split.fractional,
      kinds: kindsFromCounts(split.counts),
      summary: iconSummary(split.counts)
    };
  }

  function parseGuess(raw) {
    var text = String(raw == null ? '' : raw).trim().replace(/%$/, '').trim();
    if (!text || !/^\d+(\.\d+)?$/.test(text)) {
      return { ok: false, message: 'Enter a percent from 0 to 100.' };
    }
    var value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return { ok: false, message: 'Enter a percent from 0 to 100.' };
    }
    return { ok: true, value: value };
  }

  function absoluteError(guessPercent, ppv) {
    return Math.abs(guessPercent - ppv * 100);
  }

  function readScore(storage) {
    if (!storage) return [];
    try {
      var raw = storage.getItem(SCORE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.errors)) return [];
      return data.errors.filter(function (n) {
        return typeof n === 'number' && Number.isFinite(n) && n >= 0;
      });
    } catch (err) {
      return [];
    }
  }

  function writeScore(storage, errors) {
    if (!storage) return;
    try {
      storage.setItem(SCORE_KEY, JSON.stringify({ errors: errors }));
    } catch (err) {
      /* The score still shows on the page when storage is blocked. */
    }
  }

  function mean(errors) {
    if (!errors.length) return null;
    var sum = 0;
    for (var i = 0; i < errors.length; i++) sum += errors[i];
    return sum / errors.length;
  }

  var api = {
    SCORE_KEY: SCORE_KEY,
    STEPS: STEPS,
    STOPS: STOPS,
    ASSUMPTION: ASSUMPTION,
    compute: compute,
    formatPercent: formatPercent,
    formatBurden: formatBurden,
    formatPrevalence: formatPrevalence,
    prevalenceFromSlider: prevalenceFromSlider,
    sliderIndexForPrevalence: sliderIndexForPrevalence,
    countsPerThousand: countsPerThousand,
    kindsFromCounts: kindsFromCounts,
    viewModel: viewModel,
    parseGuess: parseGuess,
    absoluteError: absoluteError,
    readScore: readScore,
    writeScore: writeScore,
    mean: mean
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BaseRates = api;

  function boot() {
    var caseKicker = document.getElementById('case-kicker');
    var caseTitle = document.getElementById('case-title');
    var caseScenario = document.getElementById('case-scenario');
    var caseFacts = document.getElementById('case-facts');
    var form = document.getElementById('guess-form');
    var guess = document.getElementById('guess');
    var guessError = document.getElementById('guess-error');
    var estimateResult = document.getElementById('estimate-result');
    var reveal = document.getElementById('reveal');
    var notes = document.getElementById('edge-notes');
    var assumption = document.getElementById('nnt-assumption');
    var rounding = document.getElementById('rounding-note');
    var slider = document.getElementById('prevalence');
    var sliderOut = document.getElementById('prev-out');
    var cells = {
      tp: document.querySelector('[data-cell="tp"]'),
      fn: document.querySelector('[data-cell="fn"]'),
      fp: document.querySelector('[data-cell="fp"]'),
      tn: document.querySelector('[data-cell="tn"]')
    };
    var icons = document.getElementById('icons');
    var nextBtn = document.getElementById('next-case');
    var scoreNow = document.getElementById('score-now');
    var restart = document.getElementById('restart');
    if (!form || !slider) return;

    var storage = null;
    try { storage = root.localStorage; } catch (err) { storage = null; }

    var cases = [];
    var index = 0;
    var locked = false;
    var freshPass = false;
    var errors = readScore(storage);

    assumption.textContent = ASSUMPTION;

    function scoreLabel() {
      if (!errors.length) {
        scoreNow.textContent = 'No estimates yet.';
        return;
      }
      var avg = mean(errors);
      var prefix = freshPass ? 'Session score' : 'Saved session score';
      scoreNow.textContent = prefix + ': mean absolute error ' + avg.toFixed(2) +
        ' percentage points over ' + errors.length + (errors.length === 1 ? ' estimate.' : ' estimates.');
    }

    function factRow(term, value) {
      var wrap = document.createElement('div');
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = value;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      return wrap;
    }

    function paint(model) {
      document.getElementById('m-ppv').textContent = model.text.ppv;
      document.getElementById('m-npv').textContent = model.text.npv;
      document.getElementById('m-nne').textContent = model.text.nne;
      document.getElementById('m-nnt').textContent = model.text.nnt;
      document.getElementById('m-flagged').textContent = model.text.riskFlagged;
      document.getElementById('m-clear').textContent = model.text.riskClear;
      sliderOut.textContent = model.text.prevalence;
      slider.setAttribute('aria-valuetext', model.text.prevalence);
      cells.tp.textContent = String(model.counts.tp);
      cells.fn.textContent = String(model.counts.fn);
      cells.fp.textContent = String(model.counts.fp);
      cells.tn.textContent = String(model.counts.tn);
      notes.textContent = model.notes.join(' ');
      if (model.roundingNote) {
        rounding.hidden = false;
        rounding.textContent = model.roundingNote;
      } else {
        rounding.hidden = true;
        rounding.textContent = '';
      }
      icons.setAttribute('aria-label', model.summary);
      var frag = document.createDocumentFragment();
      for (var i = 0; i < model.kinds.length; i++) {
        var mark = document.createElement('i');
        mark.dataset.kind = model.kinds[i];
        mark.setAttribute('aria-hidden', 'true');
        frag.appendChild(mark);
      }
      icons.replaceChildren(frag);
    }

    function renderAt(p) {
      var item = cases[index];
      paint(viewModel(item.se, item.sp, p, item.rrr));
    }

    function showCase() {
      var item = cases[index];
      var total = cases.length;
      locked = false;
      caseKicker.textContent = 'Case ' + (index + 1) + ' of ' + total;
      caseTitle.textContent = item.title;
      caseScenario.textContent = item.scenario;
      caseFacts.replaceChildren(
        factRow('Prevalence, fictional', item.prevalenceLabel),
        factRow('Sensitivity at this threshold, fictional', item.sensitivityLabel),
        factRow('Specificity at this threshold, fictional', item.specificityLabel),
        factRow('Alert threshold', item.threshold),
        factRow('Action and its fictional RRR', item.action + ' RRR ' + item.rrrLabel + '.')
      );
      guess.value = '';
      guess.disabled = false;
      form.querySelector('button').disabled = false;
      guessError.textContent = '';
      estimateResult.textContent = '';
      reveal.hidden = true;
      nextBtn.hidden = true;
      slider.value = String(sliderIndexForPrevalence(item.p));
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (locked) return;
      var item = cases[index];
      var parsed = parseGuess(guess.value);
      if (!parsed.ok) {
        guessError.textContent = parsed.message;
        return;
      }
      var metrics = compute(item.se, item.sp, item.p, item.rrr);
      if (metrics.ppv === null) {
        guessError.textContent = 'This case has no PPV to estimate.';
        return;
      }
      guessError.textContent = '';
      var err = absoluteError(parsed.value, metrics.ppv);
      if (!freshPass) {
        errors = [];
        freshPass = true;
      }
      errors.push(err);
      writeScore(storage, errors);
      scoreLabel();
      estimateResult.textContent = 'Off by ' + err.toFixed(2) + ' percentage points. The exact fictional PPV is ' +
        formatPercent(metrics.ppv) + '.';
      locked = true;
      guess.disabled = true;
      form.querySelector('button').disabled = true;
      reveal.hidden = false;
      renderAt(item.p);
      nextBtn.hidden = false;
      nextBtn.textContent = index === cases.length - 1 ? 'Session complete' : 'Next case';
      reveal.focus();
      reveal.scrollIntoView({ block: 'start' });
    });

    slider.addEventListener('input', function () {
      if (!locked) return;
      renderAt(prevalenceFromSlider(slider.value));
    });

    nextBtn.addEventListener('click', function () {
      if (index >= cases.length - 1) {
        nextBtn.hidden = true;
        estimateResult.textContent = estimateResult.textContent + ' That was the last case.';
        return;
      }
      index += 1;
      showCase();
      guess.focus();
    });

    restart.addEventListener('click', function () {
      errors = [];
      freshPass = true;
      writeScore(storage, errors);
      index = 0;
      scoreLabel();
      showCase();
      guess.focus();
    });

    fetch('cases.json').then(function (response) {
      if (!response.ok) throw new Error('cases');
      return response.json();
    }).then(function (data) {
      cases = (data.cases || []).filter(function (item) {
        return item && typeof item.scenario === 'string' &&
          [item.p, item.se, item.sp, item.rrr].every(function (n) {
            return typeof n === 'number' && n >= 0 && n <= 1;
          });
      });
      if (cases.length !== 10) throw new Error('count');
      scoreLabel();
      showCase();
    }).catch(function () {
      caseScenario.textContent = 'The cases could not be loaded from this page.';
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
