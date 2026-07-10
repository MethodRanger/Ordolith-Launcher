import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import pngToIco from "png-to-ico"
import png2icons from "png2icons"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, "build", "ordolith-logo.svg")
const output = join(root, "build", "icons")
const rendererOutput = join(root, "src", "renderer", "public")
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

await mkdir(output, { recursive: true })
await mkdir(rendererOutput, { recursive: true })

for (const size of sizes) {
  await sharp(source, { density: 1024 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(join(output, `ordolith-${size}.png`))
}

const icoSources = await Promise.all(
  [16, 24, 32, 48, 64, 128, 256].map((size) => readFile(join(output, `ordolith-${size}.png`))),
)
await writeFile(join(output, "ordolith.ico"), await pngToIco(icoSources))

const png1024 = await readFile(join(output, "ordolith-1024.png"))
const icns = png2icons.createICNS(png1024, png2icons.BILINEAR, 0)
if (!icns) throw new Error("Failed to generate ICNS")
await writeFile(join(output, "ordolith.icns"), icns)

await sharp(source, { density: 512 }).resize(32, 32).png().toFile(join(output, "ordolith-tray.png"))
await sharp(source, { density: 512 }).resize(256, 256).png().toFile(join(rendererOutput, "ordolith-logo.png"))
await writeFile(join(rendererOutput, "ordolith-logo.svg"), await readFile(source))

console.log(`Generated Ordolith icons in ${output}`)
