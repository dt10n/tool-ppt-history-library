import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readBuiltHtml = () => readFile(new URL("../dist/index.html", import.meta.url), "utf8");

test("builds an EdgeOne-ready HTML entry", async () => {
  const html = await readBuiltHtml();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>PPT 历史配图库<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /\/assets\/index-[^"']+\.js/);
});

test("does not render obsolete starter content", async () => {
  const html = await readBuiltHtml();

  assert.doesNotMatch(html, /Your site is taking shape/i);
  assert.doesNotMatch(html, /Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});

test("cloud functions use Supabase and COS instead of D1 and R2", async () => {
  const search = await readFile(new URL("../cloud-functions/api/search.js", import.meta.url), "utf8");
  const image = await readFile(new URL("../cloud-functions/api/image.js", import.meta.url), "utf8");
  assert.match(search, /search_library_pages/);
  assert.match(image, /cos-nodejs-sdk-v5/);
  assert.doesNotMatch(`${search}\n${image}`, /env\.DB|env\.MEDIA|cloudflare:workers/);
});
