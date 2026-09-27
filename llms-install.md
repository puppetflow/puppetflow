# Puppetflow MCP Server - AI Installation Guide (`llms-install.md`)

This document gives AI assistants such as Cline, Claude Desktop, Cursor, and other MCP clients step-by-step instructions to connect to the Puppetflow MCP server.

## Overview

Puppetflow ships a remote [Model Context Protocol](https://modelcontextprotocol.io/) server as part of the platform. There is nothing to install locally: the server is exposed by every Puppetflow instance over Streamable HTTP, and the MCP client only needs the endpoint URL and a credential.

The server lets an AI client search, inspect, create, and run browser automation flows, follow runs, retrieve results, screenshots, downloads, and session recordings, and manage workspace teams.

Requirements:

- A Puppetflow instance. Use [Puppetflow Cloud](https://puppetflow.com) or a self-hosted instance installed with `curl -fsSL https://puppetflow.com/install.sh | bash` (see [docs/INSTALL.md](docs/INSTALL.md)).
- A workspace where MCP is enabled by an administrator.
- An MCP access token (recommended for Cline) or an OAuth-capable MCP client.

Self-hosted instances must be reachable from the machine running the MCP client and must use HTTPS outside local development.

## Step 1: Ask the user for the endpoint and the token

The AI assistant cannot generate these values. Ask the user to retrieve them from Puppetflow:

1. Open **Workspace > Settings > Instance MCP**.
2. Make sure **Enable instance-level MCP for this workspace** is enabled.
3. In **MCP tools**, enable the tools the client may use.
4. In **Exposed flows**, enable **Available in MCP** for each flow the client may inspect or run.
5. Under **Access Token Endpoint**, copy the **HTTP MCP endpoint**. It looks like `https://your-puppetflow.example/api/mcp-server/http`.
6. Enter a client name such as `Cline`, click **Create token**, and copy the generated `mcp_...` token. It is only displayed once.

The token acts with the permissions of the user who created it. Never commit it to a repository or paste it into a shared file.

## Step 2: Locate the Cline MCP configuration file

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **Linux**: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Cline CLI**: `~/.cline/mcp.json`

You can also open the Cline **MCP Servers** panel, select **Remote Servers**, and add the endpoint with the **Streamable HTTP** transport instead of editing the file.

## Step 3: Add the `puppetflow` server entry

Read the existing JSON file, or start from `{"mcpServers": {}}` if it does not exist, then merge the following entry under `mcpServers`. Replace the URL with the endpoint copied in Step 1 and the token with the generated `mcp_...` value.

```json
{
  "mcpServers": {
    "puppetflow": {
      "type": "streamableHttp",
      "url": "https://your-puppetflow.example/api/mcp-server/http",
      "headers": {
        "Authorization": "Bearer mcp_your_token_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

The `type` field must be `streamableHttp`. Do not use the legacy `sse` transport.

No environment variables, packages, Docker images, or local processes are required.

## Step 4: Verify the connection

Reload the MCP servers in Cline, then ask:

```text
List the Puppetflow flows available to me.
```

The client should return the flows that are exposed to MCP and visible to the token owner. You can then ask for the details of a specific flow, or run one with JSON input if the `run_flow` tool is enabled.

## Alternative: OAuth endpoint

Clients that support remote MCP OAuth (Claude, Claude Code, and others) can use the **OAuth MCP endpoint** shown under **Workspace > Settings > Instance MCP** instead of a fixed token:

```text
https://your-puppetflow.example/api/workspaces/{workspace}/mcp-server/http
```

The client discovers the authorization and token URLs automatically, registers itself with PKCE, and opens Puppetflow so the user can sign in and approve access. See the [MCP guide](https://docs.puppetflow.com/guide/mcp) for client-specific instructions.

## Other clients

### Cursor

Add to `~/.cursor/mcp.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "puppetflow": {
      "url": "https://your-puppetflow.example/api/mcp-server/http",
      "headers": {
        "Authorization": "Bearer ${env:PUPPETFLOW_MCP_TOKEN}"
      }
    }
  }
}
```

Define `PUPPETFLOW_MCP_TOKEN` in Cursor's process environment rather than writing the token in a project-level file.

### Claude Code

```bash
claude mcp add --transport http puppetflow \
  https://your-puppetflow.example/api/workspaces/work_your_workspace/mcp-server/http
```

Then run `/mcp` and select **Authenticate**.

## Available tools

Tools are enabled per workspace by an administrator. The full list includes:

- Flows: `search_flows`, `get_flow_details`, `get_flow_source`, `list_folders`, `get_flow_creation_options`, `get_nodal_catalog`, `list_flow_resources`, `write_code_flow`, `write_nodal_flow`, `publish_flow`, `unpublish_flow`
- Snippets: `search_snippets`, `get_snippet_source`, `get_snippet_creation_options`, `write_code_snippet`, `write_nodal_snippet`, `publish_snippet`, `unpublish_snippet`
- Runs: `search_runs`, `list_flow_runs`, `run_flow`, `get_run`, `get_run_result`, `continue_human_validation`
- Artifacts: `list_artifacts`, `get_latest_screenshot`, `download_artifact`, `get_recording`, `get_recording_lastshot`
- Workspace: `get_current_workspace`, `update_current_workspace`, `list_workspace_members`, `list_teams`, `get_team`, `create_team`, `update_team`, `add_team_members`, `replace_team_members`, `set_member_teams`

Every tool declares a human-readable title and read-only or destructive annotations. A flow must be visible to the connected user and have **Available in MCP** enabled before it can be executed. See the [MCP API reference](https://docs.puppetflow.com/reference/api#mcp-server) for details.

## Troubleshooting

- **The server is disabled**: confirm MCP is enabled for the instance and for the workspace under **Workspace > Settings > Instance MCP**.
- **Authentication fails**: copy the token without surrounding spaces, keep the `Bearer ` prefix, and check the token has not been revoked. Lost tokens cannot be displayed again; create a new one.
- **No flows are returned**: enable **Available in MCP** on the flow, confirm the token owner can view it, and check that the flow search tools are enabled.
- **A flow cannot be executed**: enable the `run_flow` tool and confirm the token owner has permission to run the flow.
- **A remote client cannot reach a self-hosted instance**: localhost addresses, private networks, firewalls, and invalid TLS certificates block remote clients. Use a public HTTPS URL or run the client inside the same network.
