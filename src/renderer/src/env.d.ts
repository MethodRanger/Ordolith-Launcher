/// <reference types="vite/client" />

// Static asset modules bundled by Vite. Importing them yields a URL string
// that resolves correctly under both the dev server and the packaged file://.
declare module "*.svg" {
  const src: string
  export default src
}

declare module "*.png" {
  const src: string
  export default src
}
