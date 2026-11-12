import { cn } from "@/shared/lib/utils";

/** ComputeFlux mini mark — reuses the dapp's `logo-mini.svg` geometry.
 *  Inner shapes use `fill="currentColor"` so it takes the surrounding
 *  text color (e.g. `text-white` on a dark header). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 145 145"
      className={cn("h-7 w-auto", className)}
      aria-hidden
    >
      <rect x="0" y="0" width="145" height="145" fill="none" />
      <g transform="translate(13, 41)" fill="currentColor">
        <rect x="85.3" y="1" width="33" height="8" />
        <rect x="85.3" y="56" width="33" height="8" />
        <rect x="0" y="56" width="35" height="8" />
        <rect x="0" y="1" width="35" height="8" />
        <rect
          transform="translate(60.111252, 32.466252) rotate(45) translate(-60.111252, -32.466252)"
          x="20.1112518"
          y="27.9662518"
          width="80"
          height="9"
        />
        <rect
          transform="translate(60.116252, 32.466252) rotate(135) translate(-60.116252, -32.466252)"
          x="20.1162518"
          y="27.9662518"
          width="80"
          height="9"
        />
        <rect x="0" y="8" width="8" height="49" />
        <rect x="110.3" y="8" width="8" height="48" />
      </g>
    </svg>
  );
}
