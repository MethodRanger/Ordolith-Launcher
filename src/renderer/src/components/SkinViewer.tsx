import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"

/** One pixel of a Minecraft skin, in world units. */
const PX = 0.1
/** Rectangle in skin-texture pixel space (origin = top-left of the PNG). */
type Rect = [x: number, y: number, w: number, h: number]

interface PartLayout {
  /** Box size in pixels (width, height, depth). */
  size: [number, number, number]
  /** World position of the box centre. */
  pos: [number, number, number]
  /** UV rectangles for the six faces, in Three's order: +X, -X, +Y, -Y, +Z, -Z. */
  faces: { right: Rect; left: Rect; top: Rect; bottom: Rect; front: Rect; back: Rect }
}

/**
 * Modern (64x64) skin layout. Body sits on the ground plane (feet at y = 0).
 * Heights: legs 12px, body 12px, head 8px → total 32px = 3.2 world units.
 */
const PARTS: Record<string, PartLayout> = {
  head: {
    size: [8, 8, 8],
    pos: [0, 28 * PX, 0],
    faces: {
      top: [8, 0, 8, 8], bottom: [16, 0, 8, 8],
      right: [0, 8, 8, 8], front: [8, 8, 8, 8], left: [16, 8, 8, 8], back: [24, 8, 8, 8],
    },
  },
  body: {
    size: [8, 12, 4],
    pos: [0, 18 * PX, 0],
    faces: {
      top: [20, 16, 8, 4], bottom: [28, 16, 8, 4],
      right: [16, 20, 4, 12], front: [20, 20, 8, 12], left: [28, 20, 4, 12], back: [32, 20, 8, 12],
    },
  },
  rightArm: {
    size: [4, 12, 4],
    pos: [-6 * PX, 18 * PX, 0],
    faces: {
      top: [44, 16, 4, 4], bottom: [48, 16, 4, 4],
      right: [40, 20, 4, 12], front: [44, 20, 4, 12], left: [48, 20, 4, 12], back: [52, 20, 4, 12],
    },
  },
  leftArm: {
    size: [4, 12, 4],
    pos: [6 * PX, 18 * PX, 0],
    faces: {
      top: [36, 48, 4, 4], bottom: [40, 48, 4, 4],
      right: [32, 52, 4, 12], front: [36, 52, 4, 12], left: [40, 52, 4, 12], back: [44, 52, 4, 12],
    },
  },
  rightLeg: {
    size: [4, 12, 4],
    pos: [-2 * PX, 6 * PX, 0],
    faces: {
      top: [4, 16, 4, 4], bottom: [8, 16, 4, 4],
      right: [0, 20, 4, 12], front: [4, 20, 4, 12], left: [8, 20, 4, 12], back: [12, 20, 4, 12],
    },
  },
  leftLeg: {
    size: [4, 12, 4],
    pos: [2 * PX, 6 * PX, 0],
    faces: {
      top: [20, 48, 4, 4], bottom: [24, 48, 4, 4],
      right: [16, 52, 4, 12], front: [20, 52, 4, 12], left: [24, 52, 4, 12], back: [28, 52, 4, 12],
    },
  },
}

const SKIN_SIZE = 64

/** Build a material that samples exactly the given pixel rect from the skin. */
function faceMaterial(base: THREE.Texture, rect: Rect): THREE.MeshStandardMaterial {
  const [x, y, w, h] = rect
  const tex = base.clone()
  tex.needsUpdate = true
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.repeat.set(w / SKIN_SIZE, h / SKIN_SIZE)
  // flipY defaults to true, so v = 0 is the bottom of the image.
  tex.offset.set(x / SKIN_SIZE, 1 - (y + h) / SKIN_SIZE)
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, transparent: true })
}

function CharacterModel({ texture }: { texture: THREE.Texture }): React.JSX.Element {
  const group = useRef<THREE.Group>(null)

  const parts = useMemo(
    () =>
      Object.entries(PARTS).map(([key, part]) => {
        const [w, h, d] = part.size
        const geometry = new THREE.BoxGeometry(w * PX, h * PX, d * PX)
        const materials = [
          faceMaterial(texture, part.faces.right),
          faceMaterial(texture, part.faces.left),
          faceMaterial(texture, part.faces.top),
          faceMaterial(texture, part.faces.bottom),
          faceMaterial(texture, part.faces.front),
          faceMaterial(texture, part.faces.back),
        ]
        return { key, geometry, materials, pos: part.pos }
      }),
    [texture],
  )

  // Gentle idle rotation.
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.5
  })

  return (
    <group ref={group} position={[0, -1.6, 0]}>
      {parts.map((p) => (
        <mesh key={p.key} geometry={p.geometry} material={p.materials} position={p.pos} castShadow />
      ))}
    </group>
  )
}

/**
 * Renders a Minecraft skin as a rotating 3D character. Falls back to `null`
 * (handled by the caller) when the skin texture cannot be loaded.
 */
export function SkinViewer({ skinUrl }: { skinUrl: string }): React.JSX.Element {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTexture(null)
    setFailed(false)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")
    loader.load(
      skinUrl,
      (tex) => {
        if (cancelled) return
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        tex.colorSpace = THREE.SRGBColorSpace
        setTexture(tex)
      },
      undefined,
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [skinUrl])

  if (failed) {
    return <div className="skin-viewer__fallback" />
  }

  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-3, 2, -4]} intensity={0.4} />
      {texture && <CharacterModel texture={texture} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  )
}
