import { NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const auditSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: "Security and algorithmic trust score from 0 (critical risk) to 100 (secure and transparent).",
    },
    summary: {
      type: Type.STRING,
      description: "Brief executive summary of the security and governance posture.",
    },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          severity: { type: Type.STRING, description: "CRITICAL, HIGH, MEDIUM, or LOW" },
          frameworkRef: {
            type: Type.STRING,
            description: "Reference to OWASP Top 10, OWASP LLM Top 10, NIST AI RMF, or LGPD Art. 20",
          },
          explanation: {
            type: Type.STRING,
            description: "Clear educational explanation of why this is a risk.",
          },
        },
        required: ["title", "severity", "frameworkRef", "explanation"],
      },
    },
    remediatedCode: {
      type: Type.STRING,
      description: "The complete refactored code or system prompt with all security and governance issues fixed.",
    },
    pocExploit: {
      type: Type.STRING,
      description: "Red Team Proof of Concept (PoC) demonstrating how an attacker could trigger the detected vulnerability (e.g., an educational Python/cURL exploit script for code flaws, or an adversarial Prompt Injection / Bias test payload for AI policies).",
    },
  },
  required: ["score", "summary", "findings", "remediatedCode", "pocExploit"],
};

const refineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    remediatedCode: {
      type: Type.STRING,
      description: "The updated remediated code or system prompt incorporating the user's refinement instruction while preserving all security fixes.",
    },
    agentNote: {
      type: Type.STRING,
      description: "Concise 1-2 sentence technical explanation of the adjustments applied by the agent.",
    },
  },
  required: ["remediatedCode", "agentNote"],
};

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

async function getWorkingModelName(apiKey: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) {
    throw new Error(`Failed to list models (HTTP ${res.status}). Check your GEMINI_API_KEY in .env.local`);
  }
  const data = (await res.json()) as { models?: ModelInfo[] };
  const models = data.models || [];

  const supported = models.filter(
    (m) =>
      m.name.includes("gemini") &&
      (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
  );

  const preferred =
    supported.find((m) => m.name.includes("flash")) ||
    supported.find((m) => m.name.includes("pro")) ||
    supported[0];

  if (!preferred) {
    throw new Error("No compatible Gemini model found for this API key.");
  }

  return preferred.name.replace("models/", "");
}

async function generateWithFallback(
  apiKey: string,
  contents: string,
  systemInstruction: string,
  responseSchema: Schema
) {
  const candidateModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      });
      return { response, usedModel: modelName };
    } catch {
      // Fallback to the next candidate model in the list
    }
  }

  const autoModel = await getWorkingModelName(apiKey);
  const response = await ai.models.generateContent({
    model: autoModel,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    },
  });
  return { response, usedModel: autoModel };
}

interface GithubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

async function fetchFromGithubUrl(rawInputUrl: string): Promise<{ content: string; fileName: string }> {
  const cleanUrl = rawInputUrl.trim().replace(/\/+$/, "");

  // Case 1: Direct raw.githubusercontent.com link
  if (cleanUrl.includes("raw.githubusercontent.com")) {
    const res = await fetch(cleanUrl);
    if (!res.ok) throw new Error(`GitHub Raw returned HTTP ${res.status}`);
    return {
      content: await res.text(),
      fileName: cleanUrl.split("/").pop() || "github-file",
    };
  }

  // Case 2: Specific file link (/blob/)
  if (cleanUrl.includes("github.com") && cleanUrl.includes("/blob/")) {
    const rawUrl = cleanUrl
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Failed to fetch file from GitHub (HTTP ${res.status}).`);
    return {
      content: await res.text(),
      fileName: cleanUrl.split("/").pop() || "github-file",
    };
  }

  // Case 3: Root repository or directory link (e.g., https://github.com/owner/repo)
  const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?/);
  if (match) {
    const owner = match[1];
    const repo = match[2];
    const subPath = match[3] || "";

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${subPath}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "veritas-gem-auditor",
      },
    });

    if (!res.ok) {
      throw new Error(`Repository not found or private (HTTP ${res.status}).`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("Unexpected GitHub API format.");
    }

    const items = data as GithubContentItem[];
    const codeExtensions = /\.(js|ts|tsx|jsx|py|java|cs|go|rs|php|rb|sql|html|css|json|yml|yaml|md)$/i;
    const candidateFiles = items
      .filter((item) => item.type === "file" && item.download_url && codeExtensions.test(item.name))
      .sort((a, b) => {
        const aIsReadme = a.name.toLowerCase().startsWith("readme") ? 1 : 0;
        const bIsReadme = b.name.toLowerCase().startsWith("readme") ? 1 : 0;
        return aIsReadme - bIsReadme; // Prioritize source code files before README
      })
      .slice(0, 3);

    if (candidateFiles.length === 0) {
      throw new Error("No inspectable source files found in the root of this repository.");
    }

    const fetchedParts: string[] = [];
    for (const file of candidateFiles) {
      if (!file.download_url) continue;
      const fileRes = await fetch(file.download_url);
      if (fileRes.ok) {
        const text = await fileRes.text();
        fetchedParts.push(`// === FILE: ${file.path} ===\n${text}`);
      }
    }

    return {
      content: fetchedParts.join("\n\n"),
      fileName: `${owner}/${repo} (${candidateFiles.map((f) => f.name).join(", ")})`,
    };
  }

  throw new Error("Invalid GitHub URL. Paste a public GitHub repository or file link.");
}

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { input, mode, action, currentPatch, instruction, githubUrl } = body;

    // ACTION 1: Server-side GitHub Repository / File Fetcher (Bypasses browser CORS)
    if (action === "fetch_github") {
      if (!githubUrl || typeof githubUrl !== "string") {
        return NextResponse.json({ error: "GitHub URL is required." }, { status: 400 });
      }
      const { content, fileName } = await fetchFromGithubUrl(githubUrl);
      return NextResponse.json({
        content: content.slice(0, 10000),
        fileName,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY in .env.local" }, { status: 500 });
    }

    // ACTION 2: Agentic Iterative Patch Refinement
    if (action === "refine") {
      if (!currentPatch || !instruction) {
        return NextResponse.json(
          { error: "Current patch and refinement instruction are required." },
          { status: 400 }
        );
      }

      const refineSystemInstruction = `You are veritas-gem, an autonomous DevSecOps and AI Governance Agent.
You previously audited an artifact and produced a secure remediated patch.
Now the developer is requesting an iterative refinement to that patch.
1. Strictly preserve all previous security fixes (OWASP Top 10, OWASP LLM Top 10, NIST AI RMF, and LGPD Art. 20 compliance). Never reintroduce vulnerabilities.
2. Apply the user's requested architectural, language, or policy modification cleanly.
3. Return the complete updated code/policy in 'remediatedCode' and a brief explanation in 'agentNote'.`;

      const refinePrompt = `ORIGINAL VULNERABLE ARTIFACT:
${input || "N/A"}

CURRENT REMEDIATED PATCH:
${currentPatch}

USER REFINEMENT INSTRUCTION:
${instruction}`;

      const { response, usedModel } = await generateWithFallback(
        apiKey,
        refinePrompt,
        refineSystemInstruction,
        refineSchema
      );

      const latencyMs = Date.now() - startTime;
      const result = JSON.parse(response.text || "{}");

      return NextResponse.json({
        ...result,
        telemetry: {
          model: usedModel,
          latencyMs,
        },
      });
    }

    // ACTION 3: Standard Full Security & Governance Audit + Red Team PoC
    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Input is required." }, { status: 400 });
    }

    const systemInstruction = `You are veritas-gem, an autonomous DevSecOps, Threat Intelligence, and AI Governance Auditor.
Analyze the provided ${mode === "prompt" ? "AI System Prompt / Governance Policy" : "Source Code snippet"}.
1. Detect hardcoded secrets, injection flaws (SQLi, XSS, Command Injection, Prompt Injection), broken access control, or algorithmic bias/opacity.
2. Map each finding strictly to OWASP Top 10, OWASP LLM Top 10, or NIST AI RMF.
3. CRITICAL GOVERNANCE DIRECTIVE: If analyzing an AI Prompt, enforce principles of Fair and Transparent AI. Explicitly check for violations of LGPD Artigo 20 (Right to review automated decisions) and map systemic risks to NIST AI RMF (Govern pillar). Ensure the remediated policy mandates human-in-the-loop oversight for high-stakes decisions.
4. Provide a clear, educational explanation suitable for developers and students.
5. Generate the fully remediated, production-safe version of the input in 'remediatedCode'.
6. RED TEAM VERIFICATION ('pocExploit'): Generate a safe, educational Proof of Concept (PoC) demonstrating how the original artifact can be exploited BEFORE remediation. For code, provide a commented Python 'requests' or cURL snippet targeting the exact vulnerability found. For AI prompts, provide a concrete adversarial test case (e.g., an indirect prompt injection payload or biased applicant profile) that triggers the governance failure.`;

    const { response, usedModel } = await generateWithFallback(
      apiKey,
      input,
      systemInstruction,
      auditSchema
    );

    const latencyMs = Date.now() - startTime;
    const linesInspected = input.split(/\r\n|\r|\n/).length;
    const result = JSON.parse(response.text || "{}");

    return NextResponse.json({
      ...result,
      telemetry: {
        model: usedModel,
        latencyMs,
        linesInspected,
        charsInspected: input.length,
      },
    });
  } catch (error: unknown) {
    console.error("Audit error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process request.", details: errorMessage },
      { status: 500 }
    );
  }
}