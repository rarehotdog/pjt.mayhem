import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tyler Telegram Assistant",
    short_name: "TG Assistant",
    description: "Telegram 5-bot assistant backend",
    start_url: "/",
    display: "minimal-ui",
    background_color: "#fff8ee",
    theme_color: "#ff7159",
    lang: "ko",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ]
  };
}
