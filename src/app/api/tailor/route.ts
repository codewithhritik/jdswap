import { NextRequest } from "next/server";
import { parseResume, tailorParsed } from "@/lib/gemini";
import { extractText } from "@/lib/docx";
import { TailoredResumeSchema } from "@/lib/schema";
import { createLogger, getOrCreateRequestId } from "@/lib/logger";
import { extractSourceLayout } from "@/lib/source-layout";

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const TECH_RE =
  /\b(?:React|Vue|Angular|Next\.js|Nuxt|Svelte|Node\.js|Express|Fastify|NestJS|Django|Flask|FastAPI|Spring Boot|Spring|\.NET|Rails|Laravel|Python|Java|TypeScript|JavaScript|Go|Golang|Rust|C\+\+|C#|Ruby|Swift|Kotlin|Scala|PHP|AWS|GCP|Azure|Docker|Kubernetes|K8s|Helm|Istio|GraphQL|gRPC|REST|SQL|NoSQL|MongoDB|PostgreSQL|MySQL|DynamoDB|Redis|Cassandra|Kafka|RabbitMQ|Elasticsearch|Datadog|Grafana|Prometheus|Jenkins|GitHub Actions|GitLab CI|CI\/CD|Terraform|Pulumi|Ansible|CloudFormation|CDK|Linux|Git|Agile|Scrum|Machine Learning|Deep Learning|NLP|TensorFlow|PyTorch|Spark|Hadoop|Airflow|dbt|Snowflake|BigQuery|Redshift|Microservices|Serverless|Lambda|S3|EC2|EKS|ECS|SQS|SNS|OAuth|RBAC|WebSocket|Nginx|Celery|Bazel|Maven|Gradle)\b/gi;

function extractKeywordHints(jdText: string): string[] {
  const matches = jdText.match(TECH_RE) ?? [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const m of matches) {
    const key = m.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
    if (unique.length >= 6) break;
  }
  return unique;
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const logger = createLogger({
    requestId,
    route: "/api/tailor",
    component: "tailor_route",
  });
  const requestStartedAt = Date.now();

  const formData = await request.formData();
  const file = formData.get("file");
  const jdText = formData.get("jdText");
  logger.info("tailor.request.received", {
    filePresent: file instanceof Blob,
    fileSize: file instanceof Blob ? file.size : 0,
    jdLength: typeof jdText === "string" ? jdText.length : 0,
  });

  if (!(file instanceof Blob)) {
    logger.warn("tailor.validation.failed", {
      reason: "missing_file",
      durationMs: Date.now() - requestStartedAt,
    });
    return Response.json(
      { error: "A .docx file is required." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  if (!jdText || typeof jdText !== "string") {
    logger.warn("tailor.validation.failed", {
      reason: "missing_jd_text",
      durationMs: Date.now() - requestStartedAt,
    });
    return Response.json(
      { error: "Job description is required." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  if (jdText.length > 15000) {
    logger.warn("tailor.validation.failed", {
      reason: "jd_text_too_long",
      jdLength: jdText.length,
      durationMs: Date.now() - requestStartedAt,
    });
    return Response.json(
      { error: "Job description exceeds maximum length of 15,000 characters." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseMessage(event, data)));
      };
      let phase = "extracting";

      try {
        send("progress", { step: "extracting" });

        logger.info("tailor.extract.start");
        const extractStartedAt = Date.now();
        const buf = Buffer.from(await file.arrayBuffer());
        const resumeText = await extractText(buf);
        logger.info("tailor.extract.done", {
          durationMs: Date.now() - extractStartedAt,
          resumeCharCount: resumeText.length,
        });

        if (!resumeText.trim()) {
          logger.warn("tailor.request.failed", {
            phase,
            reason: "empty_resume_text",
            durationMs: Date.now() - requestStartedAt,
          });
          send("error", {
            message: "Could not extract any text from the uploaded file.",
          });
          controller.close();
          return;
        }

        phase = "parsing";
        send("progress", { step: "parsing", charCount: resumeText.length });

        logger.info("tailor.parse.start");
        const parseStartedAt = Date.now();
        const parsed = await parseResume(
          resumeText,
          logger.child({ component: "gemini_parse" })
        );
        logger.info("tailor.parse.done", {
          durationMs: Date.now() - parseStartedAt,
          roles: parsed.experience.length,
          skills: parsed.skills.length,
          education: parsed.education.length,
          projects: parsed.projects?.length ?? 0,
        });

        send("progress", {
          step: "parsed",
          roles: parsed.experience.length,
          skills: parsed.skills.length,
          education: parsed.education.length,
          projects: parsed.projects?.length ?? 0,
        });

        const sourceLayout = extractSourceLayout(resumeText, parsed);

        const keywords = extractKeywordHints(jdText);
        send("progress", { step: "tailoring", keywords });

        phase = "tailoring";
        logger.info("tailor.tailor.start", { keywordsCount: keywords.length });
        const tailorStartedAt = Date.now();
        const tailored = await tailorParsed(
          parsed,
          jdText,
          (progress) => {
            send("progress", progress);
          },
          logger.child({ component: "gemini_tailor" })
        );
        logger.info("tailor.tailor.done", {
          durationMs: Date.now() - tailorStartedAt,
        });

        const restoredTailored = TailoredResumeSchema.parse({
          ...tailored,
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          linkedin: parsed.linkedin,
          github: parsed.github,
          website: parsed.website,
          summary: null,
          education: parsed.education,
        });

        send("progress", { step: "complete" });
        send("result", {
          parsed,
          tailored: restoredTailored,
          sourceLayout,
        });
        logger.info("tailor.stream.complete", {
          experienceCount: restoredTailored.experience.length,
          projectCount: restoredTailored.projects?.length ?? 0,
          skillsCount: restoredTailored.skills.length,
          durationMs: Date.now() - requestStartedAt,
        });
        controller.close();
      } catch (error) {
        logger.error("tailor.request.failed", {
          phase,
          durationMs: Date.now() - requestStartedAt,
          err: error,
        });
        const message =
          error instanceof Error ? error.message : "An unexpected error occurred";

        let userMessage = "Something went wrong. Please try again.";
        if (message.includes("GEMINI_API_KEY") || message.includes("API key")) {
          userMessage =
            "Gemini API key is not configured. Check your .env.local file.";
        } else if (message.includes("parse") || message.includes("Zod")) {
          userMessage =
            "Failed to generate a valid resume structure. Please try again.";
        }

        send("error", { message: userMessage });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-request-id": requestId,
    },
  });
}
