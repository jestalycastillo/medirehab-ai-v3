import type { ComponentProps } from "react";

/** Brand artwork is separate from activity/exercise navigation icons. */
export function MediRehabLogo({ title, style, ...props }: ComponentProps<"img"> & { title?: string }) {
  // A local SVG preserves gradients without duplicate inline gradient IDs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src="/brand/medirehab.svg" alt={title ?? ""} aria-hidden={title ? undefined : true} width={32} height={32} style={{ objectFit: "contain", flexShrink: 0, ...style }} />;
}
