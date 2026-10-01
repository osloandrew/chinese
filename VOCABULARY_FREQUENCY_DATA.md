# Chinese vocabulary-frequency data

`vocabulary-frequency.json` supplies the frequency ranks used by the **All
Words** frequency sort and the **Word Game**. It is kept separate from
`chineseWords.csv` so corpus updates cannot silently alter dictionary content.

## Source and permitted use

The data comes from the National Academy for Educational Research (NAER, 國家教育研究院)
**通用詞頻表 (general word-frequency table), 定稿 1141208**, published with the
COCT corpus documents:

- Download page: <https://coct.naer.edu.tw/page.jsp?ID=41>
- Source file: `通用詞頻表 - 定稿1141208.xlsx` (163,701 words, Traditional
  Chinese, Taiwanese Mandarin)
- Columns used: written, spoken and news frequency per million words
- Spoken data mostly comes from television-program subtitles, not natural
  conversation.

NAER publishes a general policy allowing attributed reuse and adaptation. It has
**not** been confirmed against this specific workbook, so confirm before
publishing the app beyond personal use. The app stores only the small derived
records that match its own dictionary and does not redistribute the full list.

## Matching and ranking

The builder matches each row's `wordTrad` exactly against the COCT word column.
There is no character-level fallback. A word's frequency is never inferred from
its characters. Rows whose headword is not in COCT (mostly Simplified/mainland
forms such as 冰激凌, and phrases such as 你好) get no record and keep neutral
weighting throughout the app.

The blended rate is `0.6 × spoken + 0.4 × written` (per million; see
`SPOKEN_SHARE` in the script). It is transformed with `log1p`, normalized to a
0–1 `weight`, and ranked from most to least frequent. A second percentile is
calculated inside each CEFR band. The Word Game uses that percentile only to
refine a word's position inside its existing CEFR level; it cannot move a word
across levels.

Frequency is per written form, not per reading or sense, so homographs share
one count. Dictionary rows with the same headword and part of speech share one
record.

The generated file records the source workbook's SHA-256 hash.

## Rebuild

Download the workbook, then run (requires `openpyxl`):

```sh
npm run build:frequency -- --source \
  "/path/to/通用詞頻表 - 定稿1141208.xlsx"
```

The build is deterministic for the same workbook and dictionary CSV.
