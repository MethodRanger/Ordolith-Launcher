import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron"
import { join } from "node:path"

let tray: Tray | null = null

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  if (tray) return tray

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "icons", "ordolith-tray.png")
    : join(__dirname, "../../build/icons/ordolith-tray.png")
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image)
  tray.setToolTip("Ordolith")
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Ordolith",
        click: () => {
          const window = getWindow()
          window?.show()
          window?.focus()
        },
      },
      {
        label: "Hide",
        click: () => getWindow()?.hide(),
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  )
  tray.on("double-click", () => {
    const window = getWindow()
    if (window?.isVisible()) window.hide()
    else {
      window?.show()
      window?.focus()
    }
  })
  return tray
}
