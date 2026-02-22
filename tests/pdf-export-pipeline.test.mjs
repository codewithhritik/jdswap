import test from "node:test";
import assert from "node:assert/strict";

const {
  buildCompactedPdfResult,
  createCompactedPdfResultBuilder,
} = await import(new URL("../src/lib/pdf-export-pipeline.ts", import.meta.url));

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
      ],
      projects: null,
    },
    sourceLayout: {
      sections: [
        { kind: "experience", heading: "WORK EXPERIENCE", lines: [] },
        { kind: "skills", heading: "SKILLS", lines: [] },
        { kind: "education", heading: "EDUCATION", lines: [] },
      ],
    },
  };
}

test("buildCompactedPdfResult returns PDF bytes and page count", async () => {
  const payload = buildEnhancedPayload();
  const result = await buildCompactedPdfResult(payload.resume, payload.sourceLayout);

  assert.ok(result.pdfBytes.length > 1000);
  assert.equal(String.fromCharCode(result.pdfBytes[0]), "%");
  assert.equal(String.fromCharCode(result.pdfBytes[1]), "P");
  assert.equal(String.fromCharCode(result.pdfBytes[2]), "D");
  assert.equal(String.fromCharCode(result.pdfBytes[3]), "F");
  assert.ok(result.pageCount >= 1);
  assert.ok(result.estimatedLines > 0);
});

test("builder uses dependency hooks and surfaces estimated lines", async () => {
  const payload = buildEnhancedPayload();
  const calls = [];
  const builder = createCompactedPdfResultBuilder({
    buildCanonicalResumeDocumentModel: () => ({
      paragraphs: [{ style: "body", text: "Line" }],
    }),
    renderCanonicalResumePdf: async () => {
      calls.push("render");
      return { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), pageCount: 3 };
    },
    estimateResumeLines: () => {
      calls.push("estimate");
      return 77;
    },
  });

  const result = await builder(payload.resume, payload.sourceLayout);
  assert.equal(result.pageCount, 3);
  assert.equal(result.estimatedLines, 77);
  assert.deepEqual(calls, ["render", "estimate"]);
});
