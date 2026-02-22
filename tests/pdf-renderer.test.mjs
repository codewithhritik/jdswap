import test from "node:test";
import assert from "node:assert/strict";

const { buildCanonicalResumeDocumentModel } = await import(
  new URL("../src/lib/export-model.ts", import.meta.url)
);
const { renderCanonicalResumePdf } = await import(
  new URL("../src/lib/pdf-renderer.ts", import.meta.url)
);

function buildEnhancedPayload() {
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

test("renderCanonicalResumePdf returns PDF bytes and page count", async () => {
  const payload = buildEnhancedPayload();
  const model = buildCanonicalResumeDocumentModel(
    payload.resume,
    payload.sourceLayout
  );

  const rendered = await renderCanonicalResumePdf(model);

  assert.ok(rendered.bytes.length > 1000);
  assert.ok(rendered.pageCount >= 1);
  assert.equal(String.fromCharCode(rendered.bytes[0]), "%");
  assert.equal(String.fromCharCode(rendered.bytes[1]), "P");
  assert.equal(String.fromCharCode(rendered.bytes[2]), "D");
  assert.equal(String.fromCharCode(rendered.bytes[3]), "F");
});


test("renderCanonicalResumePdf supports wrapped skills lines", async () => {
  const payload = buildEnhancedPayload();
  payload.resume.skills = [
    "Languages: Go, Python, TypeScript, JavaScript, Java, C++, Rust, Kotlin, Swift, Scala, C#, Ruby, Elixir",
  ];
  const model = buildCanonicalResumeDocumentModel(
    payload.resume,
    payload.sourceLayout
  );

  const rendered = await renderCanonicalResumePdf(model);

  assert.ok(rendered.bytes.length > 800);
  assert.ok(rendered.pageCount >= 1);
});
