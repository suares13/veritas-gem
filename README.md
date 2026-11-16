<div align="center">

# `>// veritas-gem`
### Autonomous DevSecOps, Threat Intelligence & AI Governance Auditor

[![Status](https://img.shields.io/badge/STATUS-PRODUCTION_READY-10b981?style=for-the-badge&logoColor=white)](https://github.com/suares13/veritas-gem)
[![Track](https://img.shields.io/badge/GENHACKS_2026-AGENTIC_SYSTEMS_%7C_CYBERSECURITY-f97316?style=for-the-badge)](https://github.com/suares13/veritas-gem)
[![Engine](https://img.shields.io/badge/CORE-GOOGLE_GEMINI_FLASH-3b82f6?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Compliance](https://img.shields.io/badge/FRAMEWORKS-OWASP_%7C_NIST_AI_RMF_%7C_LGPD-e11d48?style=for-the-badge)](https://github.com/suares13/veritas-gem)
[![License](https://img.shields.io/badge/LICENSE-MIT-71717a?style=for-the-badge)](./LICENSE)

<p align="center">
  <strong>Bridging the gap between offensive vulnerability verification, automated code remediation, and ethical AI governance.</strong>
</p>

[Overview](#-01-executive-overview) •
[Architecture](#-02-agentic-architecture) •
[Core Capabilities](#-03-enterprise-capabilities) •
[Compliance Matrix](#-04-security--governance-matrix) •
[Quick Start](#-05-local-deployment) •
[CI/CD Gate](#-06-devsecops-cicd-integration)

</div>

---

## `// 01. Executive Overview`

Modern engineering teams face a dual-front crisis: **accelerated software delivery** introducing critical code vulnerabilities (SQLi, hardcoded secrets, XSS) and **unregulated AI deployment** introducing systemic algorithmic bias, opacity, and Indirect Prompt Injection.

**`veritas-gem`** is an autonomous, dual-mode auditing platform powered by the **Google Gemini API** (`@google/genai`). Rather than acting as a passive static analyzer that merely flags errors, `veritas-gem` operates as an **interactive Purple Team & Governance Agent**:

1. **Detects & Maps:** Quantifies risk via a deterministic **Trust Score (0–100)** and maps every finding to **OWASP Top 10**, **OWASP LLM Top 10**, **NIST AI RMF**, and **Brazilian LGPD Art. 20**.
2. **Proves Exploitability (Red Team):** Generates an educational, pre-remediation **Proof of Concept (PoC)** exploit script or adversarial payload to tangibly demonstrate threat impact.
3. **Remediates & Visualizes (Blue Team):** Produces production-ready, refactored code or fair AI policies with a native line-by-line **Visual Diff Viewer**.
4. **Iterates Contextually (Agentic Loop):** Features an embedded **Agentic Co-Auditor** that refactors patches on demand while strictly preserving all prior security and compliance guardrails.

---

## `// 02. Agentic Architecture`

```text
+-----------------------------------------------------------------------------------+
|                        INPUT INGESTION LAYER (EPHEMERAL)                          |
|   [ Direct Code/Prompt ]      [ Local File Upload ]      [ Server GitHub Fetch ]  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                   VERITAS-GEM CORE ENGINE (Next.js App Router)                    |
|  +-----------------------------------------------------------------------------+  |
|  | Google Gemini Structured Output Engine (Strict JSON Schema Enforcement)     |  |
|  | Automatic Multi-Model Fallback: gemini-3.5-flash -> gemini-2.0 -> Discovery |  |
|  +-----------------------------------------------------------------------------+  |
+-------------------+-----------------------------+---------------------------------+
                    |                             |
        [ Mode A: Code Security ]     [ Mode B: AI Governance ]
                    |                             |
                    v                             v
+-----------------------------------+ +---------------------------------------------+
| • OWASP Top 10 (2021) Mapping     | | • OWASP LLM Top 10 (Prompt Injection)       |
| • Secret & Credential Detection   | | • NIST AI RMF (Govern / Map / Measure)      |
| • Parameterized Patch Generation  | | • LGPD Art. 20 (Right to Human Review)      |
| • Python/cURL Red Team PoC Script | | • Fair & Transparent Policy Refactoring     |
+-------------------+---------------+ +---------------------+-----------------------+
                    |                                       |
                    +-------------------+-------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                     INTERACTIVE AGENTIC REFINEMENT LOOP                           |
|   User Instruction -> Context-Aware Co-Auditor -> Live Diff & Patch Regeneration  |
+-----------------------------------------------------------------------------------+
```

---

## `// 03. Enterprise Capabilities`

* **Dual-Domain Inspection Engine:** Seamlessly switch between **Code Security (OWASP)** for source code/configuration files and **AI Governance (NIST / LLM)** for system prompts and automated decision policies.
* **Offensive Red Team PoC Generator:** Automatically synthesizes a pre-remediation Proof of Concept (`requests` Python exploit script or adversarial prompt injection payload) to validate threat vectors before patching.
* **Native Line-by-Line Diff Viewer:** Built-in Longest Common Subsequence (LCS) dynamic programming diff engine highlighting removed unsafe lines (`-`) and injected secure lines (`+`) alongside a clean patch view.
* **Agentic Patch Refinement (Interactive Co-Auditor):** Context-aware conversational loop allowing developers to request architectural changes (e.g., *"Convert to strict TypeScript with Zod"*, *"Add Helmet & rate-limiting"*, *"Enforce dual human sign-off"*) without reintroducing vulnerabilities.
* **Server-Side GitHub Repository & File Fetcher:** Bypasses browser CORS limitations to pull source files or auto-discover inspectable code directly from public GitHub repository URLs.
* **One-Click DevSecOps CI/CD Gate Generator:** Exports a ready-to-use GitHub Actions workflow (`.github/workflows/veritas-gem.yml`) that blocks Pull Requests if the Gemini Trust Score drops below `80/100`.
* **Privacy-First Local Audit History (LGPD Compliant):** Zero-database ephemeral API processing paired with client-side `localStorage` persistence for restoring recent inspections without exposing sensitive artifacts to external storage.
* **Real-Time Execution Telemetry & Markdown Export:** Tracks active Gemini engine, execution latency (ms), and line scope, with 1-click export to structured `.md` compliance reports.

---

## `// 04. Security & Governance Matrix`

| Audit Domain | Threat Vector / Risk | Enforced Framework | Autonomous Remediation Strategy |
| :--- | :--- | :--- | :--- |
| **Application Security** | SQL / Command Injection & XSS | `OWASP A03:2021` | Parameterized queries, prepared statements, and strict output encoding. |
| **Application Security** | Hardcoded API Keys & Credentials | `OWASP A07:2021` | Secret extraction to environment variables (`process.env`) and vault patterns. |
| **LLM Security** | Direct & Indirect Prompt Injection | `OWASP LLM01` | Delimiter isolation, untrusted data sandboxing, and instruction hierarchy enforcement. |
| **AI Governance** | Algorithmic Bias & Redlining | `NIST AI RMF (Govern/Map)` | Removal of protected-characteristic proxies (gender, age, postal code) and objective rubric enforcement. |
| **Legal Compliance** | Opaque Automated Decisions | `LGPD Art. 20` | Mandatory *Human-in-the-Loop* (HITL) review clauses and right-to-explanation audit trails. |

---

## `// 05. Local Deployment`

### Prerequisites
* **Node.js** `v18.17+` or `v20+`
* A valid **Google Gemini API Key** ([Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/suares13/veritas-gem.git](https://github.com/suares13/veritas-gem.git)
   cd veritas-gem
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

4. **Launch the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## `// 06. DevSecOps CI/CD Integration`

`veritas-gem` can be embedded directly into your continuous integration pipeline. Click **`CI/CD Action (.yml)`** in the application header to generate and download the workflow, or add it to `.github/workflows/veritas-gem.yml`:

```yaml
name: veritas-gem Autonomous DevSecOps & AI Governance Gate

on:
  pull_request:
    branches: [ "main", "master" ]

jobs:
  veritas-gem-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run veritas-gem Gemini Security & Governance Gate
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          AUDIT_MODE: "code"
          MIN_TRUST_SCORE: "80"
        run: |
          TARGET_FILE=$(git diff --name-only origin/main...HEAD | head -n 1)
          [ -z "$TARGET_FILE" ] && exit 0
          curl -sS -X POST "[https://veritas-gem.vercel.app/api/analyze](https://veritas-gem.vercel.app/api/analyze)" \
            -H "Content-Type: application/json" \
            -d "{\"mode\": \"$AUDIT_MODE\", \"input\": $(jq -Rs . < "$TARGET_FILE")}" \
            | jq -e ".score >= ($MIN_TRUST_SCORE | tonumber)"
```

---

## `// 07. Tech Stack`

* **Frontend & Routing:** Next.js 16 (App Router), React 19, TypeScript
* **Styling & UI:** Tailwind CSS, Lucide Icons (Enterprise Dark Monospace UI)
* **AI & Structured Reasoning:** Google Gemini API (`@google/genai` SDK) with strict JSON Schema validation and resilient multi-model fallback
* **Security & Privacy Architecture:** Ephemeral server-side execution, zero-persistence API design, client-side LGPD-compliant storage

---

## `// 08. Author & Research Context`

Developed by **Victória Suares** (`@suares13`) — Software Engineering undergraduate, AI Intern, and Scientific Initiation Researcher (PIBIC) focusing on **Fair, Transparent, and Ethical AI in Algorithmic Systems**, **GRC (Governance, Risk, and Compliance)**, and **Threat Intelligence**.

* **GitHub:** [@suares13](https://github.com/suares13)
* **License:** Distributed under the [MIT License](./LICENSE).