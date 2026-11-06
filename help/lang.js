/*
 * Which language the help page opens in (specs/078-help-page).
 *
 * The page asks i18next's browser detector, in this order: the `?lng=` query,
 * the reader's last choice, then each of the browser's languages. Every
 * candidate goes through `normalize` first: any Portuguese is `pt-BR`, any
 * French, Spanish or English is its base code, and anything else is no
 * candidate at all, so the detector moves on and English is what is left.
 * `pickLanguage` is the same rule as one function, for the tests.
 */
(function (root) {
  const H = (root.HELP_I18N = root.HELP_I18N || { resources: {} });
  H.SUPPORTED = ["en", "pt-BR", "fr", "es"];

  // A supported code for one of the four, or the code itself (lowercased) for
  // any other language: i18next's detector expects a string back, and with
  // `supportedLngs` set it skips an unsupported one and falls back to English.
  H.normalize = function normalize(code) {
    const c = String(code || "").trim().toLowerCase().replace(/_/g, "-");
    if (c === "pt" || c.startsWith("pt-")) return "pt-BR";
    const base = c.split("-")[0];
    return ["en", "fr", "es"].includes(base) ? base : c;
  };

  H.pickLanguage = function pickLanguage(browserLanguages, stored, query) {
    for (const candidate of [query, stored, ...(Array.isArray(browserLanguages) ? browserLanguages : [browserLanguages])]) {
      const lang = H.normalize(candidate);
      if (H.SUPPORTED.includes(lang)) return lang;
    }
    return "en";
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
