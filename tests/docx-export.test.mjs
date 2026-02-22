import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { NextRequest } from "next/server.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function getPostHandler() {
  const routeModule = require("../.next-prod/server/app/api/download/docx/route.js");
  const post = routeModule.routeModule?.userland?.POST;
  assert.equal(typeof post, "function");
  return post;
}

function buildBasePayload() {
  return {
    resume: {
      name: "Hrithik Bagane",
      email: "hrithik@example.com",
      phone: "408-640-8054",
      linkedin: "linkedin.com/in/hrithik",
      github: "github.com/hrithik",
      website: null,
      summary: null,
      skills: [
        "Languages: Go, Python, TypeScript, JavaScript, Java, C++",
        "Frameworks: React, Redux, Node.js, Next.js, Spring Boot, Flask",
        "Cloud/AWS: ECS, DynamoDB, Lambda, SQS, EC2, S3, RDS",
        "Tools: Docker, Kubernetes, Terraform, Kafka, CI/CD, GitHub Actions",
      ],
      experience: [
        {
          company: "Lucid Motors",
          title: "Software Engineer",
          location: "Fremont, CA",
          dateRange: "Jun 2025 - Present",
          bullets: [
            {
              text: "Designed a full-stack OTA update platform for 100K+ vehicles using Python microservices and a React/TypeScript frontend, replacing 3 legacy tools and centralizing 5+ data sources.",
            },
            {
              text: "Optimized high-volume backend services by implementing asynchronous Python workers with Kafka, reducing p95 API latency by 60% and improving data consistency by 40%.",
            },
            {
              text: "Shipped AI-assisted developer workflows for PR review and log analysis, saving 8-12 engineering hours weekly and reducing debugging effort by 30%.",
            },
          ],
        },
      ],
      education: [
        {
          institution: "San Jose State University",
          degree: "Master of Science, Software Engineering",
          dateRange: "Aug 2023 - May 2025",
          gpa: null,
          honors: null,
        },
        {
          institution: "Vishwakarma University",
          degree: "Bachelor of Technology, Computer Science",
          dateRange: "Aug 2017 - May 2021",
          gpa: null,
          honors: null,
        },
      ],
      projects: [
        {
          name: "Amrit",
          technologies: "Next.js, Flask, PostgreSQL, AWS",
          bullets: [
            {
              text: "Built a hackathon-winning AI recovery platform with Next.js, Flask, and AWS Lambda, delivering a gamified user journey where AI agents verified progress to improve engagement.",
            },
          ],
        },
      ],
    },
    sourceLayout: {
      sections: [
        { kind: "experience", heading: "WORK EXPERIENCE", lines: [] },
        { kind: "skills", heading: "SKILLS", lines: [] },
        {
          kind: "education",
          heading: "EDUCATION",
          lines: [],
          educationDetailBlocks: [
            [
              "Coursework - Algorithms, Distributed Systems, Cloud Computing, Web UI Development",
              "Research Assistant - Designed and built a full-stack Kubernetes management application using React and a Go backend API. Feb 2024 - May 2024",
            ],
            [
              "Coursework - Database Principles, Data Structures, Machine Learning, Data Science",
            ],
          ],
        },
        { kind: "projects", heading: "PROJECT EXPERIENCE", lines: [] },
        {
          kind: "custom",
          heading: "ACHIEVEMENTS",
          lines: [
            "2x Hackathon winner (LA Hacks - UCLA, SF Hacks - SFSU) competing against 400+ teams.",
            "Pitched product idea to 150+ CEOs and entrepreneurs at ZEE Business Dare to Dream Awards 2019.",
          ],
        },
      ],
    },
  };
}

async function postJson(post, payload) {
  const req = new NextRequest("http://localhost/api/download/docx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return post(req);
}

test("download route rejects legacy/invalid payload and accepts JSON contract", async () => {
  const post = getPostHandler();

  const invalidReq = new NextRequest("http://localhost/api/download/docx", {
    method: "POST",
    headers: { "content-type": "multipart/form-data" },
    body: "legacy payload",
  });
  const invalidRes = await post(invalidReq);
  assert.equal(invalidRes.status, 400);

  const validRes = await postJson(post, buildBasePayload());
  assert.equal(validRes.status, 200);
  assert.equal(
    validRes.headers.get("content-type"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
});

test("generated DOCX preserves education details and source-only custom section", async () => {
  const post = getPostHandler();
  const res = await postJson(post, buildBasePayload());
  assert.equal(res.status, 200);

  const buffer = Buffer.from(await res.arrayBuffer());
  const output = await mammoth.extractRawText({ buffer });
  assert.match(output.value, /Research Assistant/i);
  assert.match(output.value, /ACHIEVEMENTS/i);
});

test("compaction trims long bullets before dropping skills", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const longBullet =
    "Built large-scale platform features across multiple services and workflows while improving reliability, observability, and performance for critical paths. ".repeat(
      8
    );

  payload.resume.experience[0].bullets = [
    { text: longBullet },
    { text: longBullet },
    { text: longBullet },
    { text: longBullet },
    { text: longBullet },
  ];
  payload.resume.projects = null;
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) => section.kind !== "projects" && section.kind !== "custom"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);

  const buffer = Buffer.from(await res.arrayBuffer());
  const output = await mammoth.extractRawText({ buffer });

  const bulletCount = (output.value.match(/•/g) ?? []).length;
  assert.ok(bulletCount < 5);
  assert.match(output.value, /Frameworks: React, Redux, Node\.js, Next\.js, Spring Boot, Flask/);
});

test("route returns 422 when one-page fit conflicts with preserved sections", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const longLine =
    "Preserved custom content line with substantial detail that should remain unchanged and consume layout budget. ".repeat(
      20
    );

  payload.sourceLayout.sections.push({
    kind: "custom",
    heading: "PUBLICATIONS",
    lines: [longLine, longLine, longLine, longLine, longLine, longLine, longLine],
  });
  payload.resume.experience[0].bullets = [{ text: longLine }];
  payload.resume.projects = null;

  const res = await postJson(post, payload);
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error, /Strict one-page fit conflicts/i);
});
