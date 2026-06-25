import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

/**
 * 简单的 CSS 压缩函数
 */
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除注释
    .replace(/\n/g, '')                 // 移除换行符
    .replace(/\s+/g, ' ')               // 移除多余空格
    .replace(/\s*:\s*/g, ':')           // 移除冒号后的空格
    .replace(/\s*;\s*/g, ';')           // 移除分号后的空格
    .replace(/\s*{\s*/g, '{')           // 移除大括号前后的空格
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*,\s*/g, ',')           // 移除逗号后的空格
    .trim();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..");
const outputDir = path.join(appDir, "www");

const itemsToCopy = [
  "index.html",
  "calc.html",
  "yinmai.html",
  "css",
  "data",
  "extern",
  "js",
  "static"
];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const item of itemsToCopy) {
  const source = path.join(repoRoot, item);
  const destination = path.join(outputDir, item);

  if (!existsSync(source)) {
    throw new Error(`Missing required source path: ${source}`);
  }

  cpSync(source, destination, { recursive: true });
}

// 压缩 CSS 文件
const cssDir = path.join(outputDir, "css");
const styleCssPath = path.join(cssDir, "style.css");
const styleMinCssPath = path.join(cssDir, "style.min.css");

if (existsSync(styleCssPath)) {
  const css = readFileSync(styleCssPath, "utf-8");
  const minified = minifyCSS(css);
  writeFileSync(styleMinCssPath, minified, "utf-8");

  const originalSize = Buffer.byteLength(css, "utf-8");
  const minifiedSize = Buffer.byteLength(minified, "utf-8");
  const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  console.log(`CSS minified: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
}

const dataDir = path.join(outputDir, "data");
for (const entry of readdirSync(dataDir)) {
  if (!entry.endsWith(".json.gz")) {
    continue;
  }

  const gzPath = path.join(dataDir, entry);
  const jsonPath = path.join(dataDir, entry.replace(/\.gz$/, ""));
  const jsonContent = gunzipSync(readFileSync(gzPath));
  writeFileSync(jsonPath, jsonContent);
  unlinkSync(gzPath);
}

const copiedEntries = readdirSync(outputDir).sort();
console.log(`Built Capacitor web assets into ${outputDir}`);
console.log(`Copied: ${copiedEntries.join(", ")}`);
