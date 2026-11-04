import { toPng } from "html-to-image";

export async function downloadElementAsPng(
  element: HTMLElement,
  filename: string = "export.png"
) {
  console.log(`Starting download for: ${filename}`);

  try {
    // Use html-to-image to convert element to PNG with current theme background
    const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    const transparentPixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z/C/HwAF/gJ/1QbN7wAAAABJRU5ErkJggg==";

    const dataUrl = await toPng(element, {
      cacheBust: true,
      backgroundColor: bg,
      // pixelRatio: 2,
      imagePlaceholder: transparentPixel,
      filter: (node) => {
        const el = node as HTMLElement;
        if (el?.classList?.contains("exclude-from-export")) return false;
        // Skip cross-origin <img> to avoid CORS failures
        if (el && el.tagName === "IMG") {
          try {
            const src = (el as HTMLImageElement).src;
            if (!src) return true;
            const u = new URL(src, window.location.href);
            if (u.origin !== window.location.origin) return false;
          } catch {
            return false;
          }
        }
        return true;
      },
    });

    // Create download link
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();

    console.log(`Successfully downloaded: ${filename}`);
  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  }
}
