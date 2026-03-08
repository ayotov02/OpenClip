"use client";

import "./star-border.css";

interface StarBorderProps {
  className?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
  href?: string;
  target?: string;
  rel?: string;
}

export default function StarBorder({
  className = "",
  color = "white",
  speed = "6s",
  thickness = 1,
  children,
  href,
  target,
  rel,
}: StarBorderProps) {
  const Tag = href ? "a" : "button";

  return (
    <Tag
      className={`star-border-container ${className}`}
      style={{ padding: `${thickness}px 0` }}
      {...(href ? { href, target, rel } : {})}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="inner-content">{children}</div>
    </Tag>
  );
}
