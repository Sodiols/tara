"use client";

import { useLanguage } from "@/lib/i18n";
import { sizeGuideRows } from "@/data/sizeGuide";

export function SizeGuideTable() {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 pr-4 font-medium text-ink">{t("product.size")}</th>
            <th className="py-3 pr-4 font-medium text-ink">Chest</th>
            <th className="py-3 pr-4 font-medium text-ink">Waist</th>
            <th className="py-3 pr-4 font-medium text-ink">Hip</th>
            <th className="py-3 font-medium text-ink">Length</th>
          </tr>
        </thead>
        <tbody>
          {sizeGuideRows.map((row) => (
            <tr key={row.size} className="border-b border-border">
              <td className="py-3 pr-4 text-ink font-medium">{row.size}</td>
              <td className="py-3 pr-4 text-muted">{row.chest}</td>
              <td className="py-3 pr-4 text-muted">{row.waist}</td>
              <td className="py-3 pr-4 text-muted">{row.hip}</td>
              <td className="py-3 text-muted">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
