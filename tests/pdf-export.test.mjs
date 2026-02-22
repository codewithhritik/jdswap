import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function getPostHandler() {
  const routeModule = await Promise.resolve(
    require("../.next-prod/server/app/api/download/pdf/route.js")
  );
  const post = routeModule.routeModule?.userland?.POST;
  assert.equal(typeof post, "function");
  return post;
}

function buildResume() {
  return {
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
  };
}

function buildEnhancedPayload() {
  return {
    resume: buildResume(),
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
  const req = new NextRequest("http://localhost/api/download/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return post(req);
}

test("download PDF route rejects legacy payload", async () => {
  const post = await getPostHandler();

  const legacyRes = await postJson(post, buildResume());
  assert.equal(legacyRes.status, 400);
});

test("download PDF route accepts enhanced payload", async () => {
  const post = await getPostHandler();
  const enhancedRes = await postJson(post, buildEnhancedPayload());
  assert.equal(enhancedRes.status, 200);
  assert.equal(enhancedRes.headers.get("content-type"), "application/pdf");
  assert.ok(Number(enhancedRes.headers.get("x-page-count")) >= 1);
  assert.match(enhancedRes.headers.get("x-export-revision") ?? "", /^[a-f0-9]{24}$/);
  assert.ok((await enhancedRes.arrayBuffer()).byteLength > 1000);
});

test("download PDF route rejects malformed payload", async () => {
  const post = await getPostHandler();
  const res = await postJson(post, { resume: { name: "bad" } });
  assert.equal(res.status, 400);
});

test("download PDF route allows multi-page export for long resumes", async () => {
  const post = await getPostHandler();
  const payload = buildEnhancedPayload();
  const longLine = "Critical production migration detail with measured outcomes. ".repeat(200);
  payload.resume.experience[0].bullets = [{ text: longLine }];
  payload.resume.projects = null;
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) =>
      section.kind === "experience" ||
      section.kind === "skills" ||
      section.kind === "education"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);
  assert.ok(Number(res.headers.get("x-page-count")) >= 1);
});

test("download PDF route returns non-empty PDF bytes for enhanced payload", async () => {
  const post = await getPostHandler();
  const res = await postJson(post, buildEnhancedPayload());
  assert.equal(res.status, 200);

  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.ok(bytes.length > 1000);
  assert.equal(String.fromCharCode(bytes[0]), "%");
  assert.equal(String.fromCharCode(bytes[1]), "P");
  assert.equal(String.fromCharCode(bytes[2]), "D");
  assert.equal(String.fromCharCode(bytes[3]), "F");
});

test("download PDF route stays available when render-check is enabled", async () => {
  const post = await getPostHandler();
  const previousRenderCheck = process.env.ONE_PAGE_RENDER_CHECK;
  process.env.ONE_PAGE_RENDER_CHECK = "1";

  try {
    const res = await postJson(post, buildEnhancedPayload());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
  } finally {
    if (previousRenderCheck === undefined) delete process.env.ONE_PAGE_RENDER_CHECK;
    else process.env.ONE_PAGE_RENDER_CHECK = previousRenderCheck;
  }
});
