import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function generate() {
  const projectRoot = path.join(__dirname, "..");
  const publicDir = path.join(projectRoot, "public");
  const tmpDir = path.join(projectRoot, ".tmp-icons");
  const srcSvg = path.join(publicDir, "placeholder.png");
  const outIco = path.join(publicDir, "app.ico");

  // If already exists and looks fine, skip
  try {
    const stat = await fs.stat(outIco);
    if (stat.size > 0) {
      console.log("Icon already exists at", outIco);
      return;
    }
  } catch {}

  await ensureDir(tmpDir);

  // If no SVG fallback, try to upscale favicon.ico is not reliable; prefer SVG
  try {
    await fs.access(srcSvg);
  } catch {
    throw new Error(
      "Source SVG not found at public/placeholder.svg. Please add a high-res SVG or adjust the generator."
    );
  }

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(srcSvg)
      .resize(size, size, { fit: "contain" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngBuffers.push(buf);
  }

  const icoBuffer = await pngToIco(pngBuffers);
  await fs.writeFile(outIco, icoBuffer);
  // Cleanup tmp if created files (we used buffers only)
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log("Generated Windows icon at", outIco);
}

generate().catch((e) => {
  console.error("Failed to generate Windows icon:", e);
  process.exit(1);
});
