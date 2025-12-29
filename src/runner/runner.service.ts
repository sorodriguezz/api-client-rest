import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { lookup } from "node:dns/promises";
import * as net from "node:net";
import { NodeDoc } from "../nodes/node.schema";

@Injectable()
export class RunnerService {
  constructor(@InjectModel("Node") private nodeModel: Model<NodeDoc>) {}

  private headersToObj(
    headers: Array<{ key: string; value: string; enabled?: boolean }>
  ) {
    const out: Record<string, string> = {};
    for (const h of headers || []) {
      if (h.enabled === false) continue;
      if (!h.key) continue;
      out[h.key] = h.value ?? "";
    }
    return out;
  }

  private applyQueryParams(
    url: URL,
    query: Array<{ key: string; value: string; enabled?: boolean }>
  ) {
    for (const q of query || []) {
      if (q.enabled === false) continue;
      if (!q.key) continue;
      url.searchParams.append(q.key, q.value ?? "");
    }
  }

  private isHostAllowed(hostname: string) {
    const allowed = (process.env.RUNNER_ALLOWED_HOSTS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.length) return true;
    return allowed.some(
      (entry) => hostname === entry || hostname.endsWith(`.${entry}`)
    );
  }

  private isBlockedHostname(hostname: string) {
    if (hostname === "localhost") return true;
    if (hostname.endsWith(".localhost")) return true;
    if (hostname.endsWith(".local")) return true;
    if (hostname.endsWith(".internal")) return true;
    if (hostname === "metadata.google.internal") return true;
    return false;
  }

  private isPrivateIp(address: string) {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) {
      const parts = address.split(".").map((x) => Number(x));
      const [a, b] = parts;
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (address === "169.254.169.254") return true;
      return false;
    }

    if (ipVersion === 6) {
      const lower = address.toLowerCase();
      if (lower === "::1" || lower === "::") return true;
      if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
      if (lower.startsWith("fe80")) return true;
    }

    return false;
  }

  private async assertSafeUrl(url: URL) {
    const protocol = url.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      throw new BadRequestException({ error: "invalid_protocol" });
    }

    const hostname = url.hostname.toLowerCase();
    if (!hostname) throw new BadRequestException({ error: "invalid_host" });

    if (!this.isHostAllowed(hostname)) {
      throw new BadRequestException({ error: "blocked_host" });
    }

    if (this.isBlockedHostname(hostname)) {
      throw new BadRequestException({ error: "blocked_host" });
    }

    const ipVersion = net.isIP(hostname);
    if (ipVersion) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestException({ error: "blocked_ip" });
      }
      return;
    }

    let records: Array<{ address: string }> = [];
    try {
      records = await lookup(hostname, { all: true });
    } catch {
      throw new BadRequestException({ error: "dns_lookup_failed" });
    }

    if (!records.length) {
      throw new BadRequestException({ error: "dns_lookup_failed" });
    }

    if (records.some((r) => this.isPrivateIp(r.address))) {
      throw new BadRequestException({ error: "blocked_ip" });
    }
  }

  private buildBody(
    req: any,
    headers: Record<string, string>,
    method: string
  ) {
    const noBody = method === "GET" || method === "HEAD";
    if (noBody) return { body: undefined, bodyPreview: null };

    if (req.bodyType === "raw" || req.bodyType === "json") {
      const body = req.bodyRaw ?? "";
      if (req.bodyType === "json" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      return { body, bodyPreview: body };
    }

    if (req.bodyType === "urlencoded") {
      const params = new URLSearchParams();
      for (const f of req.bodyUrlEncoded || []) {
        if (f.enabled === false) continue;
        if (!f.key) continue;
        params.append(f.key, f.value ?? "");
      }
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
      const body = params.toString();
      return { body, bodyPreview: body };
    }

    if (req.bodyType === "formdata") {
      const form = new FormData();
      for (const f of req.bodyFormData || []) {
        if (f.enabled === false) continue;
        if (!f.key) continue;
        form.append(f.key, f.value ?? "");
      }
      return { body: form, bodyPreview: null };
    }

    if (req.bodyType === "graphql") {
      const gql = req.bodyGraphql || {};
      const payload: Record<string, any> = { query: gql.query ?? "" };
      if (typeof gql.variables === "string" && gql.variables.trim()) {
        try {
          payload.variables = JSON.parse(gql.variables);
        } catch {
          payload.variables = gql.variables;
        }
      }
      const body = JSON.stringify(payload);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      return { body, bodyPreview: body };
    }

    return { body: undefined, bodyPreview: null };
  }

  async execute(workspaceId: string, nodeId: string, timeoutMs = 20000) {
    const node = await this.nodeModel
      .findOne({ _id: nodeId, workspaceId, type: "REQUEST" })
      .lean();
    if (!node?.request) throw new NotFoundException({ error: "not_found" });

    const req = node.request;
    const method = String(req.method ?? "GET").toUpperCase();
    const headers = this.headersToObj(req.headers || []);

    let url: URL;
    try {
      url = new URL(req.urlRaw);
    } catch {
      throw new BadRequestException({ error: "invalid_url" });
    }

    this.applyQueryParams(url, req.query || []);

    if (req.authType === "bearer") {
      const token = (req.auth as any)?.token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    if (req.authType === "basic") {
      const username = (req.auth as any)?.username ?? "";
      const password = (req.auth as any)?.password ?? "";
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    }

    if (req.authType === "apiKey") {
      const key = (req.auth as any)?.key;
      const value = (req.auth as any)?.value ?? "";
      const place = String((req.auth as any)?.in ?? "header").toLowerCase();
      if (key) {
        if (place === "query") url.searchParams.append(key, value);
        else headers[key] = value;
      }
    }

    if (req.authType === "oauth2") {
      const token = (req.auth as any)?.accessToken ?? (req.auth as any)?.token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    await this.assertSafeUrl(url);

    const { body, bodyPreview } = this.buildBody(req, headers, method);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);

    const requestInfo = {
      method,
      url: url.toString(),
      headers,
      body: bodyPreview,
    };

    const start = Date.now();
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body,
        redirect: "follow",
        signal: ac.signal,
      });
      const timeMs = Date.now() - start;

      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (resHeaders[k] = v));

      return {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        timeMs,
        headers: resHeaders,
        body: text,
        request: requestInfo,
        resolvedUrl: res.url || url.toString(),
        redirected: res.redirected,
      };
    } catch (e: any) {
      const timeMs = Date.now() - start;
      return {
        ok: false,
        timeMs,
        error: e?.name === "AbortError" ? "timeout" : "fetch_error",
        request: requestInfo,
      };
    } finally {
      clearTimeout(t);
    }
  }
}
