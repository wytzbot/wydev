// GitHub's own set of license templates, as offered in its "Choose a license"
// picker (both the web "Create repository" form and the `license_template`
// field on `POST /user/repos`). Keys match GitHub's `license_template` slugs
// exactly, so they can be sent straight through to the GitHub API with no
// translation layer.
export const LICENSES = [
  { key: "", name: "None" },
  { key: "mit", name: "MIT License" },
  { key: "apache-2.0", name: "Apache License 2.0" },
  { key: "gpl-3.0", name: "GNU General Public License v3.0" },
  { key: "gpl-2.0", name: "GNU General Public License v2.0" },
  { key: "lgpl-3.0", name: "GNU Lesser General Public License v3.0" },
  { key: "lgpl-2.1", name: "GNU Lesser General Public License v2.1" },
  { key: "agpl-3.0", name: "GNU Affero General Public License v3.0" },
  { key: "bsd-2-clause", name: "BSD 2-Clause \"Simplified\" License" },
  { key: "bsd-3-clause", name: "BSD 3-Clause \"New\" or \"Revised\" License" },
  { key: "mpl-2.0", name: "Mozilla Public License 2.0" },
  { key: "epl-2.0", name: "Eclipse Public License 2.0" },
  { key: "unlicense", name: "The Unlicense" },
  { key: "cc0-1.0", name: "Creative Commons Zero v1.0 Universal" },
  { key: "bsl-1.0", name: "Boost Software License 1.0" },
];

// GitHub's raw license body text uses these bracketed placeholders. We fill
// them in client-side before staging the file so the committed LICENSE is
// ready to go rather than needing a manual edit pass.
export function fillLicensePlaceholders(body, { year, fullname }) {
  return String(body || "")
    .replace(/\[year\]/gi, year || new Date().getFullYear())
    .replace(/\[fullname\]/gi, fullname || "")
    .replace(/\[email\]/gi, "")
    .replace(/\[project\]/gi, "");
}
