import test from "node:test";
import assert from "node:assert/strict";

const { compactSkillsForExport } = await import(
  new URL("../src/lib/skills.ts", import.meta.url)
);

function splitItemsFromLine(line) {
  const idx = line.indexOf(":");
  assert.ok(idx > 0, `expected category line, received: ${line}`);
  return line
    .slice(idx + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

test("compactSkillsForExport trims Other with high-signal preference", () => {
  const compacted = compactSkillsForExport([
    "Other: Agile Development, Design Patterns, Code Reviews, GraphQL, gRPC, Vibe Coding, Tailwind CSS, Prompt Engineering",
  ]);

  assert.deepEqual(compacted, ["Other: GraphQL, gRPC, Tailwind CSS"]);
});

test("compactSkillsForExport preserves category and item order for capped categories", () => {
  const compacted = compactSkillsForExport([
    "Languages: Go, Rust, TypeScript, Java, Python, C++, Kotlin, Swift",
    "Frameworks: React, Next.js, Node.js, FastAPI, Spring Boot, Flask, Django",
  ]);

  assert.equal(compacted.length, 2);
  assert.equal(
    compacted[0],
    "Languages: Go, Rust, TypeScript, Java, Python, C++"
  );
  assert.equal(
    compacted[1],
    "Frameworks: React, Next.js, Node.js, FastAPI, Spring Boot, Flask"
  );
});

test("compactSkillsForExport keeps at most two uncategorized fallback lines", () => {
  const compacted = compactSkillsForExport([
    "Public speaking",
    "Hackathon awards",
    "Mentorship",
    "Languages: Go, Rust, TypeScript",
  ]);

  assert.deepEqual(compacted, [
    "Languages: Go, Rust, TypeScript",
    "Public speaking",
    "Hackathon awards",
  ]);
});

test("compactSkillsForExport preserves minimum core category items under line budget pressure", () => {
  const compacted = compactSkillsForExport([
    "Languages: Hyper-Scalable-Platform-Language-Alpha, Hyper-Scalable-Platform-Language-Beta, Hyper-Scalable-Platform-Language-Gamma",
  ]);

  assert.equal(compacted.length, 1);
  const languageItems = splitItemsFromLine(compacted[0]);
  assert.ok(
    languageItems.length >= 2,
    `expected at least two language items, received ${languageItems.length}`
  );
});
