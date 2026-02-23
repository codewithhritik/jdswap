import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import JSZip from "jszip";
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

async function extractDocxArtifacts(res) {
  const buffer = Buffer.from(await res.arrayBuffer());
  const [rawText, zip] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    JSZip.loadAsync(buffer),
  ]);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  assert.ok(documentXml);
  return { rawText: rawText.value, documentXml };
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
  assert.match(validRes.headers.get("x-export-revision") ?? "", /^[a-f0-9]{24}$/);
  assert.match(validRes.headers.get("x-docx-page-count") ?? "", /^[1-9][0-9]*$/);
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

test("generated DOCX sanitizes null-like values and em dashes", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  payload.resume.linkedin = "null";
  payload.resume.github = "undefined";
  payload.resume.experience[0].bullets[0].text =
    "Built backend services — modernized orchestration and reduced latency by 35% for 120K users.";
  payload.resume.education[0].gpa = "null";
  payload.resume.education[0].honors = "N/A";

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);

  const buffer = Buffer.from(await res.arrayBuffer());
  const output = await mammoth.extractRawText({ buffer });
  assert.doesNotMatch(output.value, /\bnull\b/i);
  assert.doesNotMatch(output.value, /\bundefined\b/i);
  assert.doesNotMatch(output.value, /—|–/);
});

test("generated DOCX renders skills in single column with bold labels", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const res = await postJson(post, payload);
  assert.equal(res.status, 200);

  const { rawText, documentXml } = await extractDocxArtifacts(res);
  assert.doesNotMatch(documentXml, /<w:tabs><w:tab/);
  assert.doesNotMatch(documentXml, /<w:tab\/>/);
  assert.match(
    documentXml,
    /<w:rPr><w:b\/><w:sz w:val="21"\/><w:szCs w:val="21"\/><\/w:rPr><w:t xml:space="preserve">Languages:<\/w:t>/
  );
  assert.match(
    documentXml,
    /<w:rPr><w:b\/><w:sz w:val="21"\/><w:szCs w:val="21"\/><\/w:rPr><w:t xml:space="preserve">Frameworks:<\/w:t>/
  );
  assert.match(rawText, /Languages: Go, Python, TypeScript, JavaScript, Java, C\+\+/);
  assert.match(rawText, /Frameworks: React, Redux, Node\.js, Next\.js, Spring Boot, Flask/);
  assert.match(rawText, /Cloud\/AWS: ECS, DynamoDB, Lambda, SQS, EC2, S3, RDS/);
  assert.match(rawText, /Tools: Docker, Kubernetes, Terraform, Kafka, CI\/CD, GitHub Actions/);
});

test("skills lines stay single-column even when long", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const longSkillLine =
    "Cloud: AWS, Lambda, DynamoDB, Kubernetes, Terraform, Docker, GitHub Actions, Monitoring, Incident Response, Cost Optimization, SRE";
  payload.resume.skills = [
    "Languages: Go, Rust, TypeScript",
    "Frameworks: React, Next.js, Node.js",
    longSkillLine,
    "Databases: PostgreSQL, MySQL, Redis",
    "Tools: Git, Linux, CI/CD",
  ];
  payload.resume.projects = null;
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) => section.kind !== "projects" && section.kind !== "custom"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);

  const { rawText, documentXml } = await extractDocxArtifacts(res);
  assert.doesNotMatch(documentXml, /<w:tab\/>/);
  assert.doesNotMatch(documentXml, /<w:tabs><w:tab/);
  assert.match(rawText, /Cloud: AWS, Lambda, DynamoDB, Kubernetes, Terraform, Docker/);
  assert.match(rawText, /Tools: Git, Linux, CI\/CD/);
});

test("long skill sections are preserved in multi-page DOCX output", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const longSkills = [
    "skill01",
    "skill02",
    "skill03",
    "skill04",
    "skill05",
    "skill06",
    "skill07",
    "skill08",
    "skill09",
    "skill10",
    "skill11",
    "skill12",
    "skill13",
    "skill14",
    "skill15",
    "skill16",
    "skill17",
    "skill18",
    "skill19",
    "skill20",
    "skill21",
    "skill22",
    "skill23",
    "skill24",
    "skill25",
    "skill26",
    "skill27",
    "skill28",
    "skill29",
    "skill30",
  ].join(", ");
  const markerSkills = `${longSkills}, z-last-skill`;

  payload.resume.experience[0].bullets = [
    {
      text: "Built a backend service using Go and Kafka to process partner events, reducing incident response time by 30% and improving operational reliability across critical workflows.",
    },
    {
      text: "Developed a React dashboard with role-based access controls and alerting hooks, enabling faster triage and reducing average investigation time by 26% for support teams.",
    },
    {
      text: "Implemented CI pipelines with targeted test stages and deployment checks, cutting failed releases by 35% while improving confidence in production rollouts.",
    },
    {
      text: "Optimized database query patterns and indexing strategy for high-traffic APIs, lowering p95 latency by 41% and stabilizing throughput during peak load windows.",
    },
    {
      text: "Integrated structured logging and service-level telemetry into core APIs, improving root-cause detection speed and reducing recurring incident volume by 22%.",
    },
  ];
  payload.resume.skills = [
    `Category1: ${longSkills}`,
    `Category2: ${longSkills}`,
    `Category3: ${longSkills}`,
    `Category4: ${longSkills}`,
    `Category5: ${longSkills}`,
    `Category6: ${longSkills}`,
    `Category7: ${longSkills}`,
    `Category8: ${longSkills}`,
    `Category9: ${longSkills}`,
    `Category10: ${longSkills}`,
    `Category11: ${longSkills}`,
    `Category12: ${markerSkills}`,
  ];
  payload.resume.projects = null;
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) => section.kind !== "projects" && section.kind !== "custom"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);
  const { rawText } = await extractDocxArtifacts(res);
  const bulletCount = (rawText.match(/•/g) ?? []).length;
  assert.equal(bulletCount, 5);
  assert.match(rawText, /z-last-skill/);
});

test("long sections keep project and skill tail content in multi-page DOCX output", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const denseSkillTail = Array.from({ length: 120 }, (_, idx) => `skill${idx + 1}`).join(", ");
  const longExperienceTail = "Delivered production migration and reliability improvements. ".repeat(20);
  payload.resume.skills = [
    "Languages: Go, Rust, TypeScript, Java, Python",
    "Frameworks: React, Next.js, Node.js, Spring Boot",
    "Cloud: AWS, EC2, S3, Lambda, EKS",
    "Databases: PostgreSQL, MySQL, MongoDB, Redis, DynamoDB",
    `Tools: Docker, Kubernetes, Terraform, Grafana, Jenkins, ${denseSkillTail}`,
    `Methods: CI/CD, GraphQL, gRPC, Microservices, ${denseSkillTail}`,
    `Other: Agile, Design Patterns, REST APIs, ${denseSkillTail}, z-project-preserve-tail`,
  ];
  payload.resume.experience[0].bullets = [
    ...payload.resume.experience[0].bullets,
    { text: longExperienceTail },
  ];
  payload.resume.projects = [
    {
      name: "Project Alpha",
      technologies: "Next.js, Flask, PostgreSQL, AWS",
      bullets: [
        {
          text: "Built a full-stack product analytics workflow integrating Next.js and Flask services with PostgreSQL storage, reducing report generation latency by 47% and improving stakeholder access to weekly KPIs.",
        },
      ],
    },
  ];
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) => section.kind !== "custom"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);

  const buffer = Buffer.from(await res.arrayBuffer());
  const output = await mammoth.extractRawText({ buffer });
  assert.match(output.value, /PROJECT EXPERIENCE/i);
  assert.match(output.value, /Project Alpha/);
  assert.match(output.value, /z-project-preserve-tail/);
});

test("DOCX route keeps working when render-check is enabled", async () => {
  const post = getPostHandler();
  const previousRenderCheck = process.env.ONE_PAGE_RENDER_CHECK;
  process.env.ONE_PAGE_RENDER_CHECK = "1";

  try {
    const res = await postJson(post, buildBasePayload());
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  } finally {
    if (previousRenderCheck === undefined) delete process.env.ONE_PAGE_RENDER_CHECK;
    else process.env.ONE_PAGE_RENDER_CHECK = previousRenderCheck;
  }
});

test("route allows long content and returns DOCX with revision header and explicit page breaks", async () => {
  const post = getPostHandler();
  const payload = buildBasePayload();
  const longLine = "Critical production migration detail with measured outcomes. ".repeat(200);
  payload.resume.experience[0].bullets = [{ text: longLine }];
  payload.resume.projects = null;
  payload.sourceLayout.sections = payload.sourceLayout.sections.filter(
    (section) => section.kind === "experience" || section.kind === "skills" || section.kind === "education"
  );

  const res = await postJson(post, payload);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("x-export-revision") ?? "", /^[a-f0-9]{24}$/);
  const docxPageCount = Number(res.headers.get("x-docx-page-count") ?? "0");
  assert.ok(Number.isFinite(docxPageCount) && docxPageCount >= 1);

  const { documentXml } = await extractDocxArtifacts(res);
  if (docxPageCount > 1) {
    assert.match(documentXml, /<w:br w:type="page"\/>/);
  }
});
