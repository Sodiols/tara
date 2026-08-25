import "server-only";

import { logger } from "@/lib/logger";

/**
 * Transactional email transport.
 *
 * TARA writes every order event into `notification_outbox` in the same
 * transaction that creates or changes the order, so the record exists whether
 * or not any email is ever sent. This module is only the delivery half.
 *
 * With no provider configured, `send()` reports `skipped` and says so. It does
 * NOT report success. A system that pretends to have emailed a customer is
 * worse than one that admits it did not: the order still gets picked and
 * shipped, but nobody knows the customer was never told.
 *
 * Adding a provider is one environment variable — see .env.local.example. The
 * Resend implementation is a plain `fetch` against a documented REST endpoint,
 * so it needs no SDK and works on every runtime this project deploys to.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text is required; HTML is optional and falls back to the text. */
  text: string;
  html?: string;
  replyTo?: string;
}

export type SendOutcome =
  | { status: "sent"; providerId?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendOutcome>;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "";
}

/** No provider configured. Honest about it. */
const disabledProvider: EmailProvider = {
  name: "none",
  async send() {
    return {
      status: "skipped",
      reason: "No email provider configured (set RESEND_API_KEY and EMAIL_FROM).",
    };
  },
};

/**
 * Resend, over its REST API.
 *
 * Chosen because it authenticates with a single bearer token, needs no SDK, and
 * its send endpoint is one POST. Swapping it for Postmark, SES or SMTP means
 * writing another object with this same shape — nothing outside this file knows
 * which provider is in use.
 */
function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const from = fromAddress();
      if (!from) {
        return { status: "skipped", reason: "EMAIL_FROM is not set." };
      }

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          // The body can echo the recipient address back, so only the status is
          // recorded. The full body goes to the structured log, which scrubs.
          const detail = await response.text().catch(() => "");
          logger.warn("email.provider_rejected", {
            provider: "resend",
            status: response.status,
            detail: detail.slice(0, 300),
          });
          return { status: "failed", reason: `Provider returned ${response.status}` };
        }

        const body = (await response.json().catch(() => ({}))) as { id?: string };
        return { status: "sent", providerId: body.id };
      } catch (error) {
        return {
          status: "failed",
          reason: error instanceof Error ? error.message.slice(0, 200) : "Send failed",
        };
      }
    },
  };
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  cached = apiKey ? resendProvider(apiKey) : disabledProvider;
  return cached;
}

export function isEmailConfigured(): boolean {
  return getEmailProvider().name !== "none" && Boolean(fromAddress());
}
