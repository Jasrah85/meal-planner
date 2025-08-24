import "cross-fetch/polyfill"; // if needed; or use global fetch on Node 18+
const base = "http://localhost:3000/api/recipes/import/themealdb";

async function main() {
  const queries = ["chicken", "pasta", "beef"];
  for (const q of queries) {
    const url = `${base}?q=${encodeURIComponent(q)}&limit=3&import=true`;
    const r = await fetch(url);
    console.log(q, await r.json());
  }
}
main();
