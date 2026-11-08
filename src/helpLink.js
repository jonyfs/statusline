/**
 * Where the help chip on line 3 links (specs/078-help-page, FR-005).
 *
 * The page is published to GitHub Pages from `help/` by `.github/workflows/pages.yml`.
 * The link is https, because a terminal opens an https link in the browser, while a
 * `file://` link to a local page may reveal the folder in the file manager instead.
 */
export const HELP_URL = "https://jonyfs.github.io/statusline/";
