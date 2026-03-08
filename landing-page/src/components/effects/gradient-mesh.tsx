"use client";

export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="gradient-blob-1 absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
        }}
      />
      <div
        className="gradient-blob-2 absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 70%)",
        }}
      />
      <div
        className="gradient-blob-3 absolute bottom-1/4 left-1/3 w-[550px] h-[550px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
