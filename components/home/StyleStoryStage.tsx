"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleStory } from "@/data/shopByStyle";

/**
 * "Find Your Look" as a pinned editorial scroll story.
 *
 * THE COMPOSITION
 * ---------------
 * One photograph, full bleed, edge to edge and under the header, with the copy
 * set directly on it. There is no panel, no card and no second column: the
 * layers are photograph, a readability wash, and type. Everything that is not
 * the photograph is either transparent or text.
 *
 * HOW THE PINNING WORKS
 * ---------------------
 * There is no scroll hijacking here, and no wheel or touch handler at all. The
 * outer track is several viewports tall; the stage inside it is
 * `position: sticky`, so the browser holds it in place while the track scrolls
 * past behind it and releases it the moment the track runs out. Scrolling stays
 * entirely the browser's — trackpad, wheel, touch, keyboard, scrollbar drag and
 * the back gesture all behave exactly as they do everywhere else on the page,
 * and the whole thing is reversible for free because it is a pure function of
 * the scroll position rather than a sequence of events.
 *
 * HOW PROGRESS IS MEASURED
 * ------------------------
 *     travelled = stage.top - track.top
 *
 * That is how far the sticky stage has slid down inside its own track: zero
 * before it pins, growing while it is pinned, and equal to `track height -
 * stage height` once it lets go. Deriving it this way means the component never
 * has to know the header's height or where the section sits on the page — the
 * only two numbers involved are measured from the live layout, so the CSS in
 * app/globals.css can change the pacing without this file knowing.
 *
 * WHAT COSTS A RENDER
 * -------------------
 * Almost nothing. The scroll listener is passive and coalesced into one
 * requestAnimationFrame, and the only value it writes every frame is the
 * `--fyl-progress` custom property, which drives the indicator's fill through a
 * compositor-friendly scaleX and never touches React. `setActiveIndex` runs
 * five times across the whole section, guarded so an unchanged index does not
 * reach React at all. Every transition is opacity and transform.
 *
 * BEFORE THE JAVASCRIPT RUNS
 * --------------------------
 * The server renders the first state active and all five states present, so the
 * section arrives complete: a heading, a photograph, a paragraph and a working
 * category link. The enhancement is which of the five is showing, not whether
 * there is anything to show.
 */

/** How far into the section the "scroll to explore" cue survives. */
const HINT_UNTIL_PROGRESS = 0.04;

export function StyleStoryStage({ stories }: { stories: readonly StyleStory[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const count = stories.length;

  // Read after mount so the server render and the first client render agree.
  // The global rule in app/globals.css already collapses the transitions; this
  // is what additionally drops the settling scale, which is the one piece of
  // motion here that is decoration rather than a state change.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;

    let frame = 0;
    let lastIndex = -1;
    let lastHint: boolean | null = null;

    const read = () => {
      frame = 0;
      const trackBox = track.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const travel = trackBox.height - stageBox.height;
      if (travel <= 0) return;

      const progress = Math.min(1, Math.max(0, (stageBox.top - trackBox.top) / travel));
      stage.style.setProperty("--fyl-progress", progress.toFixed(4));

      // Five equal bands. A progress of exactly 1 would land on a sixth, so the
      // last state owns the closing edge rather than falling off it.
      const index = Math.min(count - 1, Math.floor(progress * count));
      if (index !== lastIndex) {
        lastIndex = index;
        setActiveIndex(index);
      }

      const hint = progress < HINT_UNTIL_PROGRESS;
      if (hint !== lastHint) {
        lastHint = hint;
        setHintVisible(hint);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    // Both heights are viewport-derived, so anything that changes the layout —
    // a rotation, a font finally loading, a desktop window resize — has to be
    // remeasured, or progress is computed against a track that no longer exists
    // at that size.
    const observer = new ResizeObserver(schedule);
    observer.observe(track);
    observer.observe(stage);

    window.addEventListener("scroll", schedule, { passive: true });
    read();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
    };
  }, [count]);

  const active = stories[activeIndex];

  return (
    <section aria-labelledby="find-your-look">
      <div ref={trackRef} className="fyl-track relative">
        {/*
          TARA Black under the photographs rather than white. They are lazy, so
          for a moment before the section is reached there is nothing painted
          here, and on a slow connection that moment is visible — a dark ground
          reads as the campaign not yet resolved, where white reads as a fault.
          It is also what the crossfade happens over.
        */}
        <div ref={stageRef} className="fyl-stage sticky overflow-hidden bg-taraBlack">
          {/*
            The five photographs are stacked, all of them present, and only the
            active one is opaque — so a change is one image fading up through
            another with no frame in between where neither is painted. They load
            lazily, which here means all five together as the section comes into
            range, long before the second state can be reached.
          */}
          {stories.map((story, index) => {
            const isActive = index === activeIndex;
            return (
              <Image
                key={story.id}
                src={story.image}
                alt={story.imageAlt}
                fill
                quality={90}
                sizes="100vw"
                style={
                  {
                    "--fyl-focus-mobile": story.focus.mobile,
                    "--fyl-focus-tablet": story.focus.tablet,
                    "--fyl-focus-desktop": story.focus.desktop,
                  } as CSSProperties
                }
                className={cn(
                  "fyl-photo object-cover transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]",
                  isActive ? "opacity-100" : "opacity-0",
                  // Barely a movement: the incoming frame settles the last 1.5%
                  // of its scale as it arrives, which is what stops a crossfade
                  // between two still photographs reading as a slideshow.
                  !prefersReducedMotion && (isActive ? "scale-100" : "scale-[1.015]"),
                )}
              />
            );
          })}

          {/*
            Two transparent layers, and nothing else — this is legibility, not
            decoration. The flat wash takes the whole frame down a little so
            ivory type has something to sit on wherever the photograph happens
            to be pale. The directional one is the readability gradient: it
            falls where the copy is and thins out to almost nothing over the
            model, so she is never the part of the frame being darkened. Up the
            frame on a phone, across it from the left on a desktop.
          */}
          <div aria-hidden="true" className="absolute inset-0 bg-taraBlack/20" />
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0",
              "bg-gradient-to-t from-taraBlack/80 via-taraBlack/26 via-45% to-transparent",
              "lg:bg-gradient-to-r lg:from-taraBlack/62 lg:via-taraBlack/26 lg:via-48% lg:to-transparent",
            )}
          />

          {/*
            The site's Container, minus its 1440px cap. Up to 1536px the padding
            is character for character the same, so the copy starts on exactly
            the line every other homepage section starts on. Past that the cap
            would strand it: on a 1920px monitor a centred 1440px container puts
            the first letter 16% into the viewport, with a sixth of a campaign
            photograph doing nothing to its left. Holding a percentage instead
            keeps it near the frame edge, which is where a full-bleed section
            wants it.
          */}
          <div className="relative mx-auto h-full w-full px-5 md:px-8 lg:px-12 xl:px-16 2xl:px-[7vw]">
            {/*
              Low on the frame on a phone, where the model has the top two
              thirds to herself; a little below centre from lg, where she is in
              the middle of a wide crop and the copy has the left of it. Never
              centred like a banner.
            */}
            <div className="flex h-full flex-col justify-end pb-9 sm:pb-11 lg:justify-center lg:pb-0 lg:pt-[8vh]">
              <div className="max-w-[30rem] lg:max-w-[34rem] xl:max-w-[36rem]">
                <p className="font-sans text-[11px] font-semibold uppercase leading-4 tracking-[0.2em] text-taraIvory/75 sm:text-xs">
                  {"Shop by Style"}
                </p>
                <h2
                  id="find-your-look"
                  className="mt-3 font-serif text-[34px] font-normal leading-[1.03] text-taraIvory sm:text-[44px] md:text-[52px] lg:text-[60px] xl:text-[68px]"
                >
                  {"Find Your Look"}
                </h2>

                {/*
                  Both stacks are absolutely positioned inside a reserved box.
                  Laying them out in flow would mean the button stepping up and
                  down as a paragraph wraps to a different number of lines, and
                  the point of a fixed heading is that nothing under it jumps.

                  Which way a state leaves depends on which side of the active
                  one it is: everything already passed lifts up and out, and
                  everything still to come rises in from below. That is what
                  makes scrolling back up read as going back rather than as a
                  second forward step.
                */}
                <div className="relative mt-4 min-h-[4.75rem] sm:mt-5 sm:min-h-[4.5rem] lg:mt-6 lg:min-h-24">
                  {stories.map((story, index) => (
                    <p
                      key={story.id}
                      aria-hidden={index !== activeIndex}
                      className={cn(
                        "absolute inset-x-0 top-0 max-w-[34ch] font-sans text-[15px] font-normal leading-[1.65] text-taraIvory/80 transition-[opacity,transform] duration-500 ease-out sm:text-base lg:text-[18px] lg:leading-[1.7]",
                        index === activeIndex
                          ? "translate-y-0 opacity-100"
                          : index < activeIndex
                            ? "-translate-y-3 opacity-0"
                            : "translate-y-3 opacity-0",
                      )}
                    >
                      {story.description}
                    </p>
                  ))}
                </div>

                <div className="relative mt-1 min-h-12 sm:mt-2 lg:min-h-[52px]">
                  {stories.map((story, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <div
                        key={story.id}
                        aria-hidden={!isActive}
                        className={cn(
                          "absolute inset-x-0 top-0 transition-[opacity,transform] duration-500 ease-out sm:right-auto",
                          isActive && "translate-y-0 opacity-100",
                          !isActive && "pointer-events-none opacity-0",
                          !isActive && (index < activeIndex ? "-translate-y-3" : "translate-y-3"),
                        )}
                      >
                        <Link
                          href={story.href}
                          tabIndex={isActive ? undefined : -1}
                          className={cn(
                            // A minimum width shared by all five labels, so this
                            // is a fixed shape the label changes inside rather
                            // than a box that grows and shrinks over the
                            // photograph.
                            "group inline-flex h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-control",
                            "border border-wine bg-wine px-7 font-sans text-[12px] font-semibold uppercase leading-4 tracking-[0.14em] text-taraIvory",
                            "transition-colors duration-200 hover:border-taraIvory hover:bg-taraIvory hover:text-wine",
                            // The global focus ring is Deep Wine, which is the
                            // button's own colour and disappears into it here.
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taraIvory",
                            "sm:w-auto sm:min-w-[17rem] lg:h-[52px] lg:text-[13px]",
                          )}
                        >
                          {story.buttonLabel}
                          <ArrowRight
                            size={15}
                            aria-hidden="true"
                            className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                          />
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {/*
                  Decorative: the number is a position marker, and the sentence
                  below carries the same information to a screen reader without
                  it having to interpret a rail of digits. The active number is
                  underlined as well as brought to full strength, so the state
                  is not being communicated by contrast alone.
                */}
                <div className="mt-6 flex items-center gap-4 sm:mt-7 lg:mt-9" aria-hidden="true">
                  <div className="flex shrink-0 items-baseline gap-2.5 sm:gap-3">
                    {stories.map((story, index) => (
                      <span
                        key={story.id}
                        className={cn(
                          "border-b pb-1 font-sans text-[11px] tabular-nums tracking-[0.18em] transition-colors duration-300",
                          index === activeIndex
                            ? "border-taraIvory font-semibold text-taraIvory"
                            : "border-transparent font-normal text-taraIvory/45",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    ))}
                  </div>
                  <span className="relative h-px flex-1 bg-taraIvory/25 sm:w-24 sm:flex-none lg:w-28">
                    <span
                      className="absolute inset-0 origin-left bg-taraIvory"
                      style={{ transform: "scaleX(var(--fyl-progress, 0))" }}
                    />
                  </span>
                  <span
                    className={cn(
                      "hidden items-center gap-2 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-taraIvory/70 transition-opacity duration-500 lg:inline-flex",
                      hintVisible ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {"Scroll to explore"}
                    <ArrowDown size={13} className="shrink-0" />
                  </span>
                </div>

                <p className="sr-only" aria-live="polite">
                  {`${active.title}. Style ${activeIndex + 1} of ${stories.length}.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
