"use client";

import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/Button";

export default function NotFound() {

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center sm:py-32">
      <p className="mb-4 font-serif text-7xl text-wine">404</p>
      <h1 className="mb-3 font-serif text-3xl text-ink">{"Page Not Found"}</h1>
      <p className="mb-8 text-sm leading-6 text-muted">{"The page you are looking for doesn't exist or has been moved."}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button>{"Back to Home"}</Button>
        </Link>
        <LinkButton href="/unstitched-three-piece" variant="outline">
          {"Unstitched Three Piece"}
        </LinkButton>
        <LinkButton href="/ready-three-piece" variant="outline">
          {"Ready Three Piece"}
        </LinkButton>
      </div>

      <p className="mt-10 text-xs text-muted">
        {"Cannot find what you were looking for?"}{" "}
        <Link href="/contact" className="text-wine underline-offset-4 hover:underline">
          {"Contact Us"}
        </Link>
      </p>
    </div>
  );
}
