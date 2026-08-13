import { ImageResponse } from "next/og";

export const alt = "RepoSphere — Explore your codebase in 3D";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const nodes = [
  { left: 785, top: 116, size: 48, color: "#8b78ff" },
  { left: 972, top: 184, size: 34, color: "#458eff" },
  { left: 836, top: 286, size: 60, color: "#23c8b7" },
  { left: 1044, top: 348, size: 42, color: "#edbe42" },
  { left: 744, top: 452, size: 32, color: "#e55c9d" },
  { left: 934, top: 476, size: 50, color: "#74cf76" },
];

const links = [
  { left: 822, top: 156, width: 166, rotate: 20 },
  { left: 827, top: 176, width: 116, rotate: 82 },
  { left: 885, top: 321, width: 170, rotate: 22 },
  { left: 773, top: 414, width: 104, rotate: -62 },
  { left: 780, top: 467, width: 172, rotate: 8 },
  { left: 956, top: 239, width: 119, rotate: 69 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#070c15",
        color: "#edf2ff",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.32,
          backgroundImage:
            "linear-gradient(rgba(111,130,171,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(111,130,171,.12) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          right: -5,
          top: 65,
          display: "flex",
          borderRadius: 250,
          background: "radial-gradient(circle, rgba(105,87,255,.18), rgba(7,12,21,0) 68%)",
        }}
      />

      {links.map((link, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: link.left,
            top: link.top,
            width: link.width,
            height: 2,
            display: "flex",
            background: "rgba(137,151,205,.42)",
            transform: `rotate(${link.rotate}deg)`,
            transformOrigin: "left center",
          }}
        />
      ))}
      {nodes.map((node, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: node.left,
            top: node.top,
            width: node.size,
            height: node.size,
            display: "flex",
            borderRadius: Math.round(node.size * 0.28),
            border: `2px solid ${node.color}`,
            background: "#101827",
            boxShadow: `0 0 28px ${node.color}88`,
            transform: "rotate(12deg)",
          }}
        />
      ))}

      <div
        style={{
          width: 720,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 0 70px 76px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #7464ff",
              borderRadius: 15,
              background: "#131b2c",
              color: "#a9b4ff",
              fontSize: 26,
              fontWeight: 800,
              transform: "rotate(-4deg)",
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>RepoSphere</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#7464ff", fontSize: 18, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
            Interactive codebase explorer
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 70, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
            See your codebase
          </div>
          <div style={{ display: "flex", fontSize: 70, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3, color: "#9a8cff" }}>
            from every angle.
          </div>
          <div style={{ display: "flex", marginTop: 24, color: "#8290a9", fontSize: 23 }}>
            Real files, metrics and dependencies — visualized in 3D.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, color: "#596780", fontSize: 17, letterSpacing: 2, textTransform: "uppercase" }}>
          <div style={{ display: "flex" }}>GitHub repositories</div>
          <div style={{ display: "flex", color: "#354156" }}>·</div>
          <div style={{ display: "flex" }}>Local folders</div>
        </div>
      </div>
    </div>,
    size,
  );
}
