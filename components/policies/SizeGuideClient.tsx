"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SizeGuideTable } from "@/components/product/SizeGuideTable";

export function SizeGuideClient() {

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Size Guide" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{"Size Guide"}</h1>
      <p className="text-muted leading-relaxed mb-8">
        {"Use the measurements below to find your perfect fit. For the best results, measure yourself using a soft measuring tape."}
      </p>
      <SizeGuideTable />
      <div className="mt-8 text-sm text-muted leading-relaxed">
        <p>
          {"To measure accurately: measure around the fullest part of your chest, the narrowest part of your waist, and the fullest part of your hips. If your measurement falls between two sizes, we recommend choosing the larger size."}
        </p>
      </div>
    </div>
  );
}
