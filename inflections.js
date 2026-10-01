/**
 * Word-form lookup, exposed as window.Inflections.
 *
 * This app was ported from the Japanese dictionary, where this module
 * conjugated verbs and adjectives and resolved inflected text back to a
 * headword. Chinese has no inflection, so every conjugation-related call
 * returns "nothing to add" and callers fall back to the headword itself.
 * The module is kept (rather than deleted) so the many call sites in
 * scripts.js, wordGame.js and stories.js keep working unchanged; it is also
 * the natural seam for a Chinese word segmenter, which would implement
 * segmentTextSync/segmentTextAsync here.
 */
(function (global) {
  "use strict";

  // Spellings a headword can be found under in example sentences: the
  // Traditional word itself (comma-separated alternates included).
  function surfaceForms(entry) {
    return String(entry?.word ?? "")
      .split(/[,、]/)
      .map((form) => form.trim())
      .filter(Boolean);
  }

  async function findLemmas() {
    return { lemmas: [] };
  }

  function getForms() {
    return null;
  }

  function getParadigmForLemma() {
    return null;
  }

  async function getSentenceForms(entry) {
    return surfaceForms(entry);
  }

  async function getSupplementalSentenceForms(entry) {
    return surfaceForms(entry);
  }

  async function resolvePending() {
    return null;
  }

  // No segmenter yet: an empty span list means "render the text as plain
  // text", and the index is trivially ready so nothing waits on it.
  function segmentTextSync() {
    return [];
  }

  async function segmentTextAsync() {
    return [];
  }

  function isReverseIndexReady() {
    return true;
  }

  async function preload() {}

  global.Inflections = {
    findLemmas,
    getForms,
    getParadigmForLemma,
    getSentenceForms,
    getSupplementalSentenceForms,
    resolvePending,
    segmentTextSync,
    segmentTextAsync,
    isReverseIndexReady,
    preload,
  };
})(window);
