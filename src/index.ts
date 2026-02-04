#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { BASE_URLS, DEFAULT_BASE_URL } from "./constants.js";
import { ITGlueClient } from "./services/itglue-client.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerDocumentSectionTools } from "./tools/document-sections.js";

const VERSION = "1.0.0";
const SERVER_NAME = "itglue-mcp-server";

interface CliConfig {
  apiKey: string;
  baseUrl: string;
  transport: "stdio" | "http";
  port: number;
}

function printUsage(): void {
  const usage = `
${SERVER_NAME} v${VERSION} — Unofficial MCP server for the ITGlue API

Usage:
  ${SERVER_NAME} [options]

Options:
  --api-key <key>         ITGlue API key (or set ITGLUE_API_KEY env var)
  --base-url <url>        ITGlue API base URL (or set ITGLUE_BASE_URL env var)
  --region <region>       Shortcut for base URL: us, eu, or au (default: us)
  --transport <mode>      Transport mode: stdio or http (default: stdio)
  --port <port>           HTTP server port (default: 3000, or set PORT env var)
  --help                  Show this help message
  --version               Show version

Environment Variables:
  ITGLUE_API_KEY      API key for authentication (required)
  ITGLUE_BASE_URL     Base URL override (optional)
  TRANSPORT           Transport mode: stdio or http (default: stdio)
  PORT                HTTP server port (default: 3000)

MCP Client Configuration (stdio):
  {
    "mcpServers": {
      "itglue": {
        "command": "npx",
        "args": ["-y", "${SERVER_NAME}"],
        "env": {
          "ITGLUE_API_KEY": "your-api-key-here"
        }
      }
    }
  }

MCP Client Configuration (HTTP):
  {
    "mcpServers": {
      "itglue": {
        "type": "streamable-http",
        "url": "http://localhost:3000/mcp",
        "env": {
          "ITGLUE_API_KEY": "your-api-key-here"
        }
      }
    }
  }

Regions:
  us  -> ${BASE_URLS.us}
  eu  -> ${BASE_URLS.eu}
  au  -> ${BASE_URLS.au}
`.trim();

  console.error(usage);
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
}

function parseArgs(): CliConfig {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.error(`${SERVER_NAME} v${VERSION}`);
    process.exit(0);
  }

  const cliApiKey = getArgValue(args, "--api-key");
  if (cliApiKey) {
    console.error(
      "Warning: Passing --api-key via CLI exposes it in process listings. " +
        "Prefer setting ITGLUE_API_KEY as an environment variable."
    );
  }

  const apiKey = cliApiKey ?? process.env.ITGLUE_API_KEY;

  if (!apiKey) {
    console.error(
      "Error: ITGlue API key is required.\n" +
        "Set the ITGLUE_API_KEY environment variable or pass --api-key <key>.\n" +
        "Run with --help for more information."
    );
    process.exit(1);
  }

  let baseUrl = getArgValue(args, "--base-url") ?? process.env.ITGLUE_BASE_URL;

  if (!baseUrl) {
    const region = getArgValue(args, "--region");
    if (region) {
      const regionLower = region.toLowerCase();
      if (regionLower in BASE_URLS) {
        baseUrl = BASE_URLS[regionLower];
      } else {
        console.error(
          `Error: Unknown region "${region}". Valid regions: us, eu, au.`
        );
        process.exit(1);
      }
    }
  }

  const transport =
    (getArgValue(args, "--transport") ?? process.env.TRANSPORT ?? "stdio") as string;

  if (transport !== "stdio" && transport !== "http") {
    console.error(
      `Error: Unknown transport "${transport}". Valid values: stdio, http.`
    );
    process.exit(1);
  }

  const portStr = getArgValue(args, "--port") ?? process.env.PORT;
  const port = portStr ? parseInt(portStr, 10) : 3000;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(
      `Error: Invalid port "${portStr}". Must be a number between 1 and 65535.`
    );
    process.exit(1);
  }

  return {
    apiKey,
    baseUrl: baseUrl ?? DEFAULT_BASE_URL,
    transport: transport as "stdio" | "http",
    port,
  };
}

function createServer(config: CliConfig): McpServer {
  const itglueClient = new ITGlueClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: VERSION,
    },
    {
      instructions: [
        "# ITGlue MCP Server — Tool Usage Guide",
        "",
        "## Searching and Filtering",
        "- Filters use EXACT matching, not fuzzy/partial matching.",
        "- When locating a specific organization or document by name, prefer listing WITHOUT filters and scanning the results yourself rather than using a filter that may miss due to exact-match semantics.",
        "- Filters are useful when you know the exact value (e.g., an ID or precise name).",
        "",
        "## Workflow: Reading Documents",
        "1. Use itglue_list_organizations to find the organization ID.",
        "2. Use itglue_list_documents with the org ID to find documents.",
        "3. Use itglue_get_document to retrieve full content (may be truncated at 25k chars).",
        "4. If content is truncated, use itglue_list_document_sections then itglue_get_document_section for individual sections.",
        "",
        "## Workflow: Creating Documents",
        "1. itglue_create_document creates a DRAFT — it is not visible until published.",
        "2. Add content with itglue_create_document_section (supports Text, Heading, Gallery, Step types).",
        "3. Use itglue_publish_document to make it visible.",
        "",
        "## Workflow: Updating Documents",
        "- itglue_update_document only changes metadata (name). To change content, use itglue_update_document_section.",
        "- You need the section ID — get it from itglue_list_document_sections.",
        "",
        "## Important Notes",
        "- All list tools support pagination (default 50, max 1000 per page).",
        "- All read tools accept response_format: 'markdown' (default, human-readable) or 'json' (structured).",
        "- Use json format when you need to process data programmatically.",
        "- Delete operations are PERMANENT and cannot be undone.",
        "- Section content uses HTML format.",
      ].join("\n"),
    },
  );

  registerOrganizationTools(server, itglueClient);
  registerDocumentTools(server, itglueClient);
  registerDocumentSectionTools(server, itglueClient);

  return server;
}

async function runStdio(config: CliConfig): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${VERSION} running via stdio (${config.baseUrl})`);
}

async function runHttp(config: CliConfig): Promise<void> {
  const app = createMcpExpressApp();

  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express app from SDK lacks type defs
  type Req = IncomingMessage & { body?: any };
  type Res = ServerResponse & { status(code: number): Res; json(body: unknown): void; send(body: string): void };

  app.get("/health", (_req: Req, res: Res) => {
    res.json({ status: "ok", server: SERVER_NAME, version: VERSION });
  });

  app.post("/mcp", async (req: Req, res: Res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (sessionId && !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Bad request: expected initialize request" },
        id: null,
      });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { transport, server });
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    const server = createServer(config);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req: Req, res: Res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req: Req, res: Res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
  });

  const shutdown = async () => {
    console.error("Shutting down...");
    for (const [, session] of sessions) {
      await session.transport.close();
    }
    sessions.clear();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  app.listen(config.port, "0.0.0.0", () => {
    console.error(
      `${SERVER_NAME} v${VERSION} running on http://0.0.0.0:${config.port}/mcp (${config.baseUrl})`
    );
  });
}

async function main(): Promise<void> {
  const config = parseArgs();

  if (config.transport === "http") {
    await runHttp(config);
  } else {
    await runStdio(config);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
