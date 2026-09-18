"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { buildTrackedUrl } from "@/lib/analytics/attribution";
import { useToastStore } from "@/store/toastStore";
import {
  Field,
  Panel,
  PanelHeader,
  adminButtonClass,
  adminInputClass,
  adminSelectClass,
} from "./ui";

/**
 * Builds the links the dashboard above can actually group.
 *
 * Every number on this page depends on the link somebody posted carrying the
 * right five parameters, spelled the same way every time. Typed by hand into an
 * Instagram bio at eleven at night, they will not be: "Instagram", "instagram"
 * and "insta" are three sources, and a campaign misspelled once is a campaign
 * that reports half its orders.
 *
 * So the team builds links here. Values are lowercased and spaces become
 * underscores — the same normalisation the reports group by — and the result is
 * one field to copy.
 */
export function UtmLinkBuilder({ siteUrl }: { siteUrl: string }) {
  const addToast = useToastStore((state) => state.addToast);
  const [path, setPath] = useState("/");
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");

  const link = useMemo(() => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return buildTrackedUrl(`${siteUrl}${cleanPath}`, { source, medium, campaign, content });
  }, [siteUrl, path, source, medium, campaign, content]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      addToast("Link copied.");
    } catch {
      addToast("Could not copy. Select the link and copy it manually.", "error");
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Build a tracked link"
        description="Post this instead of the plain address, and everything above can tell you what it did."
      />
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
        <Field label="Page" htmlFor="utm-path" hint="The path on tarabd.co, e.g. /product/silk-kameez">
          <input
            id="utm-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/"
            className={adminInputClass}
          />
        </Field>

        <Field label="Source" htmlFor="utm-source" hint="Where the link is posted.">
          <select
            id="utm-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              // The medium follows the source, because nobody wants to think
              // about what "medium" means; it can still be edited.
              setMedium(
                event.target.value === "creator"
                  ? "influencer"
                  : event.target.value === "email"
                    ? "email"
                    : "social",
              );
            }}
            className={adminSelectClass}
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="creator">Creator</option>
            <option value="email">Email</option>
            <option value="google">Google</option>
          </select>
        </Field>

        <Field
          label="Medium"
          htmlFor="utm-medium"
          hint="social, paid, email, influencer… Use paid for an advertisement."
        >
          <input
            id="utm-medium"
            value={medium}
            onChange={(event) => setMedium(event.target.value)}
            className={adminInputClass}
          />
        </Field>

        <Field
          label="Campaign"
          htmlFor="utm-campaign"
          hint={
            source === "creator"
              ? "For a creator link, put the creator's name here — that is what the Creators table groups by."
              : "The campaign this belongs to, e.g. launch_week."
          }
        >
          <input
            id="utm-campaign"
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            placeholder={source === "creator" ? "nabila" : "launch_week"}
            className={adminInputClass}
          />
        </Field>

        <Field
          label="Content"
          htmlFor="utm-content"
          className="sm:col-span-2"
          hint="The individual post or reel, e.g. instagram_tryon_reel_01. This is how two reels are compared."
        >
          <input
            id="utm-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="instagram_tryon_reel_01"
            className={adminInputClass}
          />
        </Field>

        <Field label="The link" htmlFor="utm-result" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="utm-result"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className={`${adminInputClass} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={() => void copy()}
              className={adminButtonClass("primary", "md")}
            >
              <Copy size={15} aria-hidden="true" />
              Copy
            </button>
          </div>
        </Field>
      </div>
    </Panel>
  );
}
