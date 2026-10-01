#!/usr/bin/env python3
"""Build the browser frequency sidecar from NAER's COCT general word-frequency table."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import unicodedata
from collections import defaultdict
from pathlib import Path

import openpyxl


SOURCE_URL = "https://coct.naer.edu.tw/page.jsp?ID=41"
SOURCE_NAME = "通用詞頻表 (COCT general word-frequency table)"
CEFR_BANDS = ("A1", "A2", "B1", "B2", "C")
# Spoken frequency counts a little more than written for everyday-vocabulary
# practice. This is a product choice; tune it here and rebuild.
SPOKEN_SHARE = 0.6
WRITTEN_SHARE = 1 - SPOKEN_SHARE


def match_key(value: str) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


def runtime_key(word: str, word_class: str) -> str:
    # Mirrors getVocabularyFrequencyEntryKey() in wordGame.js.
    displayed_word = " ".join((word or "").split()).lower()
    return (
        f"{unicodedata.normalize('NFC', displayed_word)}"
        f"|{unicodedata.normalize('NFC', word_class.strip().lower())}"
    )


def read_coct(source_xlsx: Path) -> dict[str, dict]:
    workbook = openpyxl.load_workbook(source_xlsx, read_only=True)
    sheet = workbook.active
    words: dict[str, dict] = {}
    for index, row in enumerate(sheet.iter_rows(values_only=True)):
        if index == 0 or not row[1]:
            continue
        key = match_key(str(row[1]))
        if key in words:
            continue
        words[key] = {
            "sourceRank": int(row[0]),
            "written": float(row[3] or 0),
            "spoken": float(row[6] or 0),
            "news": float(row[9] or 0),
        }
    return words


def build(source_xlsx: Path, dictionary_csv: Path) -> dict:
    words = read_coct(source_xlsx)
    grouped: dict[str, dict] = {}

    with dictionary_csv.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    for row in rows:
        word = row.get("wordTrad", "")
        key = runtime_key(word, row.get("gender", ""))
        match = words.get(match_key(word))
        if not key or not match:
            continue
        blended = SPOKEN_SHARE * match["spoken"] + WRITTEN_SHARE * match["written"]
        record = grouped.setdefault(
            key, {"blended": blended, "match": match, "bands": set()}
        )
        cefr = (row.get("CEFR") or "").strip().upper()
        if cefr in CEFR_BANDS:
            record["bands"].add(cefr)

    log_values = [math.log1p(item["blended"]) for item in grouped.values()]
    minimum, maximum = min(log_values), max(log_values)
    span = maximum - minimum or 1
    for item in grouped.values():
        item["weight"] = (math.log1p(item["blended"]) - minimum) / span

    ordered = sorted(grouped.items(), key=lambda pair: (-pair[1]["weight"], pair[0]))
    for rank, (_, item) in enumerate(ordered, start=1):
        item["rank"] = rank

    by_band: dict[str, list[dict]] = defaultdict(list)
    for item in grouped.values():
        for band in item["bands"]:
            by_band[band].append(item)
    for band, items in by_band.items():
        values = [item["weight"] for item in items]
        low, high = min(values), max(values)
        band_span = high - low or 1
        for item in items:
            item.setdefault("bandPercentiles", {})[band] = round(
                (item["weight"] - low) / band_span, 6
            )

    entries = {}
    for key, item in sorted(grouped.items()):
        match = item["match"]
        entries[key] = {
            "rank": item["rank"],
            "weight": round(item["weight"], 6),
            "sources": {
                "coct": {
                    "coverage": "exact-word",
                    "sourceRank": match["sourceRank"],
                    "perMillion": {
                        "spoken": round(match["spoken"], 2),
                        "written": round(match["written"], 2),
                        "news": round(match["news"], 2),
                    },
                }
            },
            "bandPercentiles": item.get("bandPercentiles", {}),
        }

    return {
        "version": 5,
        "sources": {
            "coct": {
                "source": SOURCE_URL,
                "sourceName": SOURCE_NAME,
                "sourceFile": source_xlsx.name,
                "license": "NAER open-data reuse policy (attribution)",
                "sha256": hashlib.sha256(source_xlsx.read_bytes()).hexdigest(),
                "sourceWords": len(words),
                "matchedDictionaryEntries": len(entries),
                "blend": {"spoken": SPOKEN_SHARE, "written": WRITTEN_SHARE},
            }
        },
        "method": "exact-headword-match",
        "dictionaryRows": len(rows),
        "matchedDictionaryEntries": len(entries),
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="COCT 通用詞頻表 .xlsx")
    parser.add_argument("--dictionary", type=Path, default=Path("chineseWords.csv"))
    parser.add_argument("--output", type=Path, default=Path("vocabulary-frequency.json"))
    args = parser.parse_args()

    payload = build(args.source, args.dictionary)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.output} with {payload['matchedDictionaryEntries']} matched entries "
        f"from {payload['dictionaryRows']} dictionary rows."
    )


if __name__ == "__main__":
    main()
