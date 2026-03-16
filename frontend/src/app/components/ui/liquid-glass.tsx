import React from "react";
import { cn } from "./utils";

// SVG Filter — render once at root layout level
export const GlassFilter: React.FC = () => (
  <svg style={{ position: "absolute", width: 0, height: 0 }}>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves={1}
        seed={17}
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude={1} exponent={10} offset={0.5} />
        <feFuncG type="gamma" amplitude={0} exponent={1} offset={0} />
        <feFuncB type="gamma" amplitude={0} exponent={1} offset={0.5} />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation={3} result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale={5}
        specularConstant={1}
        specularExponent={100}
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x={-200} y={-200} z={300} />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1={0}
        k2={1}
        k3={1}
        k4={0}
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale={200}
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

// Glass Panel — wrapper for containers (sidebar, header, audio bar, etc.)
export const GlassPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className, style }) => (
  <div
    className={cn("relative overflow-hidden", className)}
    style={style}
  >
    {/* Blur + distortion layer */}
    <div
      className="absolute inset-0 z-0 rounded-inherit"
      style={{
        backdropFilter: "blur(8px)",
        filter: "url(#glass-distortion)",
        isolation: "isolate",
      }}
    />
    {/* Tint layer */}
    <div
      className="absolute inset-0 z-[1] rounded-inherit"
      style={{ background: "rgba(255, 255, 255, 0.08)" }}
    />
    {/* Inner highlight layer */}
    <div
      className="absolute inset-0 z-[2] rounded-inherit"
      style={{
        boxShadow:
          "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.15), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1)",
      }}
    />
    {/* Content */}
    <div className="relative z-[3]">{children}</div>
  </div>
);

// Glass Button — for interactive buttons with springy hover
export const GlassButton: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}> = ({ children, className, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "relative flex items-center gap-2 overflow-hidden cursor-pointer transition-all duration-700",
      disabled && "opacity-50 cursor-not-allowed",
      className,
    )}
    style={{
      boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
      transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    }}
  >
    {/* Blur + distortion layer */}
    <div
      className="absolute inset-0 z-0 rounded-inherit"
      style={{
        backdropFilter: "blur(3px)",
        filter: "url(#glass-distortion)",
        isolation: "isolate",
      }}
    />
    {/* Tint layer */}
    <div
      className="absolute inset-0 z-[1] rounded-inherit"
      style={{ background: "rgba(255, 255, 255, 0.12)" }}
    />
    {/* Inner highlight layer */}
    <div
      className="absolute inset-0 z-[2] rounded-inherit"
      style={{
        boxShadow:
          "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.2), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.15)",
      }}
    />
    {/* Content */}
    <div className="relative z-[3] flex items-center gap-2">{children}</div>
  </button>
);
