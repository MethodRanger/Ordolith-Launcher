// Single source for the Ordolith logo URL. Importing the SVG as a module lets
// the bundler emit a hashed asset with a URL that works under file:// in the
// packaged app as well as during development.
import logoUrl from "./ordolith-logo.svg"

export default logoUrl
