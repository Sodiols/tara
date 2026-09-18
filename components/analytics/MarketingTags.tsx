"use client";

import Script from "next/script";
import {
  GA4_MEASUREMENT_ID,
  META_PIXEL_ID,
  TIKTOK_PIXEL_ID,
  hasAnyPixel,
  hasGa4,
  hasMetaPixel,
  hasTikTokPixel,
} from "@/lib/analytics/config";
import { markPixelsReady } from "@/lib/analytics/pixels";

/**
 * The third-party measurement tags — GA4, Meta and TikTok.
 *
 * NOTHING RENDERS UNLESS AN ID IS CONFIGURED. A shop with no Meta pixel loads
 * no Meta script, sends no request to facebook.net, and does not name it in its
 * Content Security Policy. Adding or removing a tag is an environment variable,
 * not a code change, and no id is written into the source — a hardcoded one
 * would mean every deployment, including a developer's laptop, reporting into
 * the real shop's numbers.
 *
 * `afterInteractive`, deliberately: these scripts must never compete with the
 * product photograph or the fonts for the connection. Each snippet defines its
 * queueing stub synchronously, so an event recorded a moment later is held by
 * the tag itself until its library arrives; `markPixelsReady()` releases the
 * events TARA buffered before that point, so the first product view of a visit
 * is not the one that gets lost.
 *
 * THE FIRST PAGE VIEW IS COUNTED HERE AND NOWHERE ELSE. Each snippet reports
 * the page it loads on, and `trackPageView()` reports only the client-side
 * navigations after it (see the note there). One page, one page view, in every
 * tag.
 */
export function MarketingTags() {
  if (!hasAnyPixel) return null;

  return (
    <>
      {hasGa4 && (
        <Script
          id="ga4-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
      )}
      <Script
        id="tara-marketing-tags"
        strategy="afterInteractive"
        onReady={markPixelsReady}
        // Assembled from the vendors' own snippets. Each one installs a stub
        // that queues calls, so nothing recorded before the library lands is
        // lost, and each reports its own first page view.
        dangerouslySetInnerHTML={{
          __html: [
            hasGa4
              ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_MEASUREMENT_ID}',{currency:'BDT'});`
              : "",
            hasMetaPixel
              ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`
              : "",
            hasTikTokPixel
              ? `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(e){for(var n=ttq._i[e]||[],i=0;i<ttq.methods.length;i++)ttq.setAndDefer(n,ttq.methods[i]);return n};ttq.load=function(e,n){var r='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement('script');o.type='text/javascript';o.async=!0;o.src=r+'?sdkid='+e+'&lib='+t;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');`
              : "",
          ].join("\n"),
        }}
      />
    </>
  );
}
