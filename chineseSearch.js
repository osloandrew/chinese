/**
 * Shared search-matching helpers so a word can be found by Traditional
 * characters, Simplified characters, pinyin (with tone marks, tone numbers,
 * or no tones at all), bopomofo (zhuyin), or its English translation.
 * Loaded before scripts.js and wordList.js (see index.html) and exposed as
 * window.ChineseSearch, the same pattern as window.WordClass.
 *
 * Nothing here needs hand-entered data: every entry's pinyin is split into
 * syllables and converted to bopomofo by rule, so the dictionary CSV only
 * has to carry `word`, `wordSimp` and `pronunciation`.
 *
 * Pinyin and bopomofo queries match whole syllables only (never the middle
 * of one), so "he" finds 喝 hē but not 這 zhè, and plain English queries
 * don't flood the results with accidental substrings of pinyin.
 */
(function (global) {
  "use strict";

  // Combining marks that carry the tone in NFD-decomposed pinyin.
  const COMBINING_TONES = {
    "\u0304": 1, // macron
    "\u0301": 2, // acute
    "\u030c": 3, // caron
    "\u0300": 4, // grave
  };
  const COMBINING_DIAERESIS = "\u0308"; // turns u into ü
  const NEUTRAL_TONE = 5;

  const PINYIN_VOWELS = "aeiouv";
  const PINYIN_INITIALS_SINGLE = "bpmfdtnlgkhjqxrzcswy";
  const PINYIN_INITIALS_DOUBLE = ["zh", "ch", "sh"];

  const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  const BOPOMOFO_RE = /[\u3105-\u312f\u02c7\u02ca\u02cb\u02d9\u02c9]/;

  function normalizeSearchText(value) {
    return String(value ?? "").normalize("NFC").trim().toLowerCase();
  }

  // ---------------------------------------------------------------- pinyin

  /**
   * Split text into runs of letters ({ c, tone }) separated by anything
   * that isn't a letter, a tone mark, or a tone digit (spaces, apostrophes,
   * hyphens...). ü may be written ü, v, or u: and every tone may be a
   * diacritic or a digit (0 and 5 both mean neutral).
   */
  function toLetterRuns(text) {
    const runs = [];
    let current = [];

    const flush = () => {
      if (current.length) runs.push(current);
      current = [];
    };

    const decomposed = String(text ?? "")
      .toLowerCase()
      .replace(/u:/g, "ü")
      .normalize("NFD");

    for (const ch of decomposed) {
      const last = current[current.length - 1];
      if (ch === COMBINING_DIAERESIS) {
        if (last && last.c === "u") last.c = "v";
      } else if (COMBINING_TONES[ch]) {
        if (last) last.tone = COMBINING_TONES[ch];
      } else if (/[a-z]/.test(ch)) {
        current.push({ c: ch, tone: null });
      } else if (/[0-5]/.test(ch) && last) {
        last.tone = ch === "0" ? NEUTRAL_TONE : Number(ch);
        last.end = true; // a tone digit closes its syllable ("nv3er2")
      } else {
        flush();
      }
    }
    flush();
    return runs;
  }

  /**
   * Tokenize one run of letters into pinyin syllables, or return null if
   * it isn't made of syllable-shaped pieces ("hello" -> null).
   * `defaultTone` is what a syllable with no tone mark means: neutral for
   * dictionary entries (which always mark tones 1-4), unspecified (null)
   * for a query, where it means "any tone".
   */
  function tokenizeRun(run, defaultTone) {
    const s = run.map((l) => l.c).join("");
    const n = s.length;
    const isVowel = (k) => k < n && PINYIN_VOWELS.includes(s[k]);
    const syllables = [];
    let i = 0;

    while (i < n) {
      // A bare r after a syllable is the erhua suffix (一點兒 yīdiǎnr).
      if (s[i] === "r" && syllables.length && !isVowel(i + 1)) {
        syllables[syllables.length - 1].erhua = true;
        i += 1;
        continue;
      }

      const start = i;
      let initial = "";
      if (PINYIN_INITIALS_DOUBLE.includes(s.slice(i, i + 2))) {
        initial = s.slice(i, i + 2);
        i += 2;
      } else if (PINYIN_INITIALS_SINGLE.includes(s[i]) && isVowel(i + 1)) {
        initial = s[i];
        i += 1;
      }

      let j = i;
      while (isVowel(j)) {
        j += 1;
        if (run[j - 1].end) break;
      }
      if (j === i) return null;

      let end = j;
      if (run[j - 1].end) {
        // Syllable already closed by its tone digit; nothing may attach.
      } else if (s[j] === "n") {
        // -ng, unless the g actually starts the next syllable; -n, unless
        // the n does.
        if (s[j + 1] === "g" && !isVowel(j + 2)) end = j + 2;
        else if (!isVowel(j + 1)) end = j + 1;
      } else if (s[j] === "r" && !initial && s.slice(i, j) === "e" && !isVowel(j + 1)) {
        end = j + 1; // er
      }

      let tone = defaultTone;
      for (let k = start; k < end; k += 1) {
        if (run[k].tone !== null) tone = run[k].tone;
      }

      const final = s.slice(i, end);
      syllables.push({
        initial,
        final,
        // ü is folded into u for comparison ("nu" finds 女 nǚ), the same
        // leniency most pinyin input methods give.
        key: (initial + final).replace(/v/g, "u"),
        zy: pinyinToZhuyinSyllable(initial, final),
        tone,
        erhua: false,
      });
      i = end;
    }
    return syllables;
  }

  function parsePinyin(text, defaultTone) {
    const syllables = [];
    for (const run of toLetterRuns(text)) {
      const parsed = tokenizeRun(run, defaultTone);
      if (!parsed) return null;
      syllables.push(...parsed);
    }
    return syllables.length ? syllables : null;
  }

  // -------------------------------------------------------------- bopomofo

  const ZHUYIN_INITIALS = {
    b: "ㄅ", p: "ㄆ", m: "ㄇ", f: "ㄈ", d: "ㄉ", t: "ㄊ", n: "ㄋ", l: "ㄌ",
    g: "ㄍ", k: "ㄎ", h: "ㄏ", j: "ㄐ", q: "ㄑ", x: "ㄒ",
    zh: "ㄓ", ch: "ㄔ", sh: "ㄕ", r: "ㄖ", z: "ㄗ", c: "ㄘ", s: "ㄙ",
  };

  // Finals, with the spelling pinyin uses once y/w have been resolved back
  // to i/u/ü (yi -> i, wu -> u, yu -> ü) and uei/uen/iou written in full.
  const ZHUYIN_FINALS = {
    a: "ㄚ", o: "ㄛ", e: "ㄜ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ",
    an: "ㄢ", en: "ㄣ", ang: "ㄤ", eng: "ㄥ", er: "ㄦ",
    i: "ㄧ", ia: "ㄧㄚ", io: "ㄧㄛ", ie: "ㄧㄝ", iao: "ㄧㄠ", iou: "ㄧㄡ",
    iu: "ㄧㄡ", ian: "ㄧㄢ", in: "ㄧㄣ", iang: "ㄧㄤ", ing: "ㄧㄥ",
    iong: "ㄩㄥ",
    u: "ㄨ", ua: "ㄨㄚ", uo: "ㄨㄛ", uai: "ㄨㄞ", uei: "ㄨㄟ", ui: "ㄨㄟ",
    uan: "ㄨㄢ", uen: "ㄨㄣ", un: "ㄨㄣ", uang: "ㄨㄤ", ueng: "ㄨㄥ",
    ong: "ㄨㄥ",
    v: "ㄩ", ve: "ㄩㄝ", ue: "ㄩㄝ", van: "ㄩㄢ", vn: "ㄩㄣ",
  };

  const APICAL_I_INITIALS = new Set(["zh", "ch", "sh", "r", "z", "c", "s"]);
  const APICAL_INITIAL_SYMBOLS = ["ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ"];
  const ZHUYIN_TONE_MARKS = { "ˉ": 1, "ˊ": 2, "ˇ": 3, "ˋ": 4 };
  const ZHUYIN_NEUTRAL_MARK = "˙";

  /** One syllable's initial + final (as tokenized pinyin) -> bopomofo, no tone. */
  function pinyinToZhuyinSyllable(initial, final) {
    let i = initial;
    let f = final;

    if (i === "y") {
      i = "";
      if (f[0] === "u") f = "v" + f.slice(1); // yu, yue, yuan, yun
      else if (f[0] !== "i") f = "i" + f; // ya, ye, yao, you, yan, yang, yong
    } else if (i === "w") {
      i = "";
      if (f[0] !== "u") f = "u" + f; // wa, wo, wai, wei, wan, wen, wang, weng
    } else if ((i === "j" || i === "q" || i === "x") && f[0] === "u") {
      f = "v" + f.slice(1); // ju, qu, xu are really jü, qü, xü
    }

    // zhi, chi, shi, ri, zi, ci, si: the apical vowel has no symbol.
    if (f === "i" && APICAL_I_INITIALS.has(i)) return ZHUYIN_INITIALS[i];

    const zhuyinFinal = ZHUYIN_FINALS[f];
    if (zhuyinFinal === undefined) return null;
    return (ZHUYIN_INITIALS[i] || "") + zhuyinFinal;
  }

  function zhuyinCharStage(ch) {
    const code = ch.charCodeAt(0);
    if (code >= 0x3105 && code <= 0x3119) return 1; // initial
    if (code >= 0x3127 && code <= 0x3129) return 2; // ㄧ ㄨ ㄩ
    if (code >= 0x311a && code <= 0x3126) return 3; // final
    return 0;
  }

  /**
   * Split a bopomofo query into syllables. A new syllable starts whenever a
   * symbol can't continue the current one (initial -> medial -> final ->
   * tone), and ˙ opens a neutral-tone syllable. Returns null if the query
   * contains anything that isn't bopomofo or whitespace.
   */
  function parseZhuyin(text) {
    const syllables = [];
    let current = null;

    const finish = () => {
      if (!current || !current.chars) {
        current = null;
        return;
      }
      const previous = syllables[syllables.length - 1];
      // A toneless bare ㄦ after a syllable is the erhua suffix.
      if (current.chars === "ㄦ" && current.tone === null && previous) {
        previous.erhua = true;
      } else {
        syllables.push({
          zy: current.chars,
          tone: current.tone,
          erhua: false,
        });
      }
      current = null;
    };

    for (const ch of String(text ?? "").normalize("NFC")) {
      if (ch === ZHUYIN_NEUTRAL_MARK) {
        finish();
        current = { chars: "", tone: NEUTRAL_TONE, stage: 0 };
      } else if (ZHUYIN_TONE_MARKS[ch]) {
        if (current && current.chars) {
          current.tone = ZHUYIN_TONE_MARKS[ch];
          finish();
        }
      } else if (zhuyinCharStage(ch)) {
        const stage = zhuyinCharStage(ch);
        // ㄦ never follows another symbol in a syllable, and the apical-i
        // initials (ㄓㄔㄕㄖㄗㄘㄙ) stand alone, never taking ㄧ or ㄩ:
        // ㄕㄧㄝˋ is shī + yè, not a single syllable.
        const startsNewSyllable =
          !current ||
          stage <= current.stage ||
          ch === "ㄦ" ||
          (APICAL_INITIAL_SYMBOLS.includes(current.chars) && (ch === "ㄧ" || ch === "ㄩ"));
        if (startsNewSyllable) {
          const carriedTone = current && !current.chars ? current.tone : null;
          finish();
          current = { chars: "", tone: carriedTone, stage: 0 };
        }
        current.chars += ch;
        current.stage = stage;
      } else if (/\s/.test(ch)) {
        finish();
      } else {
        return null;
      }
    }
    finish();
    return syllables.length ? syllables : null;
  }

  /** Whole pinyin string -> bopomofo with tone marks, e.g. "xiàwǔ" -> "ㄒㄧㄚˋㄨˇ". */
  function pinyinToZhuyin(text) {
    const syllables = parsePinyin(text, NEUTRAL_TONE);
    if (!syllables) return null;
    const toneMarks = { 2: "ˊ", 3: "ˇ", 4: "ˋ" };
    let out = "";
    for (const s of syllables) {
      if (s.zy === null) return null;
      const body = s.zy + (s.erhua ? "ㄦ" : "");
      const mark = toneMarks[s.tone] || "";
      out +=
        s.tone === NEUTRAL_TONE
          ? ZHUYIN_NEUTRAL_MARK + body
          : s.zy + mark + (s.erhua ? "ㄦ" : "");
    }
    return out;
  }

  // -------------------------------------------------------------- matching

  const entrySyllablesCache = new WeakMap();

  function getEntrySyllables(entry) {
    if (!entry || typeof entry !== "object") return [];
    if (!entrySyllablesCache.has(entry)) {
      // Entries whose pinyin can't be segmented simply aren't findable by
      // pinyin or bopomofo; their characters and English still are.
      entrySyllablesCache.set(entry, parsePinyin(entry.pronunciation, NEUTRAL_TONE) || []);
    }
    return entrySyllablesCache.get(entry);
  }

  /**
   * Whether the query's syllables appear as a run of whole entry syllables.
   * A query syllable with no tone matches any tone; one with erhua only
   * matches erhua entries, but an entry's erhua is ignored otherwise
   * ("yidian" finds 一點兒 too).
   */
  function containsSyllableRun(entrySyllables, querySyllables, field) {
    const k = querySyllables.length;
    for (let start = 0; start + k <= entrySyllables.length; start += 1) {
      let matched = true;
      for (let j = 0; j < k && matched; j += 1) {
        const q = querySyllables[j];
        const e = entrySyllables[start + j];
        matched =
          q[field] !== null &&
          q[field] === e[field] &&
          (q.tone === null || q.tone === e.tone) &&
          (!q.erhua || e.erhua);
      }
      if (matched) return true;
    }
    return false;
  }

  /**
   * Whether an entry matches a query typed as Traditional or Simplified
   * characters, pinyin, or bopomofo. English matching is left to callers,
   * who already compare against entry.engelsk directly.
   */
  function matchesQuery(entry, rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query || !entry) return false;

    if (HAN_RE.test(query)) {
      return [entry.word, entry.wordSimp].some((spelling) =>
        normalizeSearchText(spelling).includes(query),
      );
    }

    if (BOPOMOFO_RE.test(query)) {
      const querySyllables = parseZhuyin(query);
      return Boolean(
        querySyllables &&
          containsSyllableRun(getEntrySyllables(entry), querySyllables, "zy"),
      );
    }

    const querySyllables = parsePinyin(query, null);
    return Boolean(
      querySyllables &&
        containsSyllableRun(getEntrySyllables(entry), querySyllables, "key"),
    );
  }

  global.ChineseSearch = {
    matchesQuery,
    parsePinyin,
    parseZhuyin,
    pinyinToZhuyin,
  };
})(window);
