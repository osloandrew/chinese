import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "chineseSearch.js"), "utf8");
const windowObject = {};
const context = vm.createContext({ window: windowObject });
vm.runInContext(source, context, { filename: "chineseSearch.js" });

const { ChineseSearch } = windowObject;
const matches = (entry, query) => ChineseSearch.matchesQuery(entry, query);

const xiawu = { word: "下午", wordSimp: "下午", pronunciation: "xiàwǔ" };
const xiawuHao = { word: "下午好", wordSimp: "下午好", pronunciation: "xiàwǔ hǎo" };
const shangke = { word: "上課", wordSimp: "上课", pronunciation: "shàngkè" };
const nuer = { word: "女兒", wordSimp: "女儿", pronunciation: "nǚ'ér" };
const yidianr = { word: "一點兒", wordSimp: "一点儿", pronunciation: "yīdiǎnr" };
const he = { word: "喝", wordSimp: "喝", pronunciation: "hē" };
const zhe = { word: "這", wordSimp: "这", pronunciation: "zhè" };

test("pinyin converts to bopomofo by rule", () => {
  const cases = {
    "xiàwǔ": "ㄒㄧㄚˋㄨˇ",
    "shàngkè": "ㄕㄤˋㄎㄜˋ",
    "nǚ'ér": "ㄋㄩˇㄦˊ",
    "zhè": "ㄓㄜˋ",
    "yī": "ㄧ",
    "yuè": "ㄩㄝˋ",
    "wǒ": "ㄨㄛˇ",
    "jūn": "ㄐㄩㄣ",
    "yīdiǎnr": "ㄧㄉㄧㄢˇㄦ",
    "shénme": "ㄕㄣˊ˙ㄇㄜ",
    "zhōngguó": "ㄓㄨㄥㄍㄨㄛˊ",
    "yǒu": "ㄧㄡˇ",
    "wèi": "ㄨㄟˋ",
    "lǜ": "ㄌㄩˋ",
    "shí": "ㄕˊ",
  };
  for (const [pinyin, zhuyin] of Object.entries(cases)) {
    assert.equal(ChineseSearch.pinyinToZhuyin(pinyin), zhuyin, pinyin);
  }
});

test("finds a word by Traditional or Simplified characters", () => {
  assert.equal(matches(shangke, "上課"), true);
  assert.equal(matches(shangke, "上课"), true);
  assert.equal(matches(shangke, "课"), true);
  assert.equal(matches(shangke, "下課"), false);
});

test("finds a word by pinyin with tone marks, tone numbers, or no tones", () => {
  for (const query of ["xiàwǔ", "xiawu", "xia4wu3", "xia4wu", "xia wu", "xiàwu", "Xia4Wu3"]) {
    assert.equal(matches(xiawu, query), true, query);
  }
  assert.equal(matches(xiawu, "xia3wu3"), false);
  assert.equal(matches(xiawu, "shangwu"), false);
});

test("pinyin matches whole syllables only", () => {
  assert.equal(matches(xiawuHao, "wuhao"), true);
  assert.equal(matches(xiawuHao, "hao"), true);
  assert.equal(matches(he, "he"), true);
  assert.equal(matches(zhe, "he"), false);
  assert.equal(matches(xiawu, "iaw"), false);
});

test("ü may be typed as ü, v, u:, or plain u", () => {
  for (const query of ["nǚ", "nü", "nv", "nu:", "nu", "nv3er2"]) {
    assert.equal(matches(nuer, query), true, query);
  }
});

test("erhua is optional in the query", () => {
  assert.equal(matches(yidianr, "yidianr"), true);
  assert.equal(matches(yidianr, "yidian"), true);
  assert.equal(matches({ ...yidianr, pronunciation: "yīdiǎn" }, "yidianr"), false);
});

test("finds a word by bopomofo with or without tone marks", () => {
  for (const query of ["ㄒㄧㄚˋㄨˇ", "ㄒㄧㄚㄨ", "ㄒㄧㄚˋㄨ", "ㄒㄧㄚˋ ㄨˇ", "ㄨˇ"]) {
    assert.equal(matches(xiawu, query), true, query);
  }
  assert.equal(matches(xiawu, "ㄒㄧㄚˊ"), false);
  assert.equal(matches(nuer, "ㄋㄩˇㄦˊ"), true);
  assert.equal(matches(yidianr, "ㄧㄉㄧㄢㄦ"), true);
  assert.equal(matches(he, "ㄏㄜ"), true);
  assert.equal(matches(zhe, "ㄏㄜ"), false);
});

test("bopomofo splits apical-i and ㄦ syllables correctly", () => {
  const shiye = { word: "失業", wordSimp: "失业", pronunciation: "shīyè" };
  const xingqier = { word: "星期二", wordSimp: "星期二", pronunciation: "xīngqī'èr" };
  assert.equal(matches(shiye, "ㄕㄧㄝˋ"), true);
  assert.equal(matches(shiye, "ㄕㄧㄝ"), true);
  assert.equal(matches(xingqier, "ㄒㄧㄥㄑㄧㄦˋ"), true);
  assert.equal(matches(xingqier, "ㄑㄧㄦˋ"), true);
});

test("English and unparsable queries don't match pinyin", () => {
  assert.equal(matches(xiawu, "hello"), false);
  assert.equal(matches(xiawu, ""), false);
  assert.equal(matches({ word: "x" }, "xia"), false);
});
