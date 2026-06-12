const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'docs');
const docsHtmlPath = path.join(root, 'docs.html');
const stylesPath = path.join(root, 'styles.css');
const faviconPath = path.join(root, 'favicon.svg');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertContains(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing expected content: ${needle}`);
  }
}

const docsHtml = read(docsHtmlPath);
const stylesCss = read(stylesPath);

assertContains(docsHtml, '<main class="docs-shell"', 'docs.html');
assertContains(docsHtml, 'href="/favicon.svg"', 'docs.html');
assertContains(docsHtml, 'href="/styles.css"', 'docs.html');
assertContains(stylesCss, '.docs-shell', 'styles.css');
assertContains(read(faviconPath), '<svg', 'favicon.svg');

const pagesHtml = docsHtml
  .replace('href="/favicon.svg"', 'href="./favicon.svg"')
  .replace('href="/styles.css"', 'href="./styles.css"')
  .replace('href="/"', 'href="https://dactyl.azurewebsites.net/"')
  .replace('Back to the pond', 'Open the hosted pond');

if (pagesHtml.includes('href="/favicon.svg"') || pagesHtml.includes('href="/styles.css"')) {
  throw new Error('Generated docs must use relative asset URLs so GitHub Pages works under /dactyl-sandbox/.');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), pagesHtml);
fs.copyFileSync(stylesPath, path.join(outDir, 'styles.css'));
fs.copyFileSync(faviconPath, path.join(outDir, 'favicon.svg'));
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`Built static docs site in ${path.relative(root, outDir)}`);
