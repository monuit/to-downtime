import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useDisruptionStore } from '../store/disruptions'
import { latLonToPlane, TORONTO_LAT, TORONTO_LON, randomPointNearby } from '../utils/mercator'

interface DisruptionPoint {
  position: THREE.Vector3
  severity: 'severe' | 'moderate' | 'minor'
  intensity: number
}

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const disruptions = useDisruptionStore((state) => state.disruptions)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup - clean minimal style
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e27)
    scene.fog = new THREE.Fog(0x0a0e27, 1000, 3000)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    )

    const torontoPosPlane = latLonToPlane(TORONTO_LAT, TORONTO_LON)
    camera.position.set(torontoPosPlane.x, 200, torontoPosPlane.y + 200)
    camera.lookAt(torontoPosPlane.x, 0, torontoPosPlane.y)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.2
    controls.minDistance = 100
    controls.maxDistance = 1200
    controls.target.set(torontoPosPlane.x, 0, torontoPosPlane.y)
    controls.update()

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(300, 500, 300)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.left = -500
    directionalLight.shadow.camera.right = 500
    directionalLight.shadow.camera.top = 500
    directionalLight.shadow.camera.bottom = -500
    scene.add(directionalLight)

    // Clean map plane with subtle texture
    const mapGeometry = new THREE.PlaneGeometry(4096, 2048)
    const mapCanvas = document.createElement('canvas')
    mapCanvas.width = 512
    mapCanvas.height = 256
    const ctx = mapCanvas.getContext('2d')!

    // Solid subtle background
    ctx.fillStyle = '#0f1a2e'
    ctx.fillRect(0, 0, 512, 256)

    // Grid pattern (subtle)
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.08)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 256)
      ctx.stroke()
    }
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(512, i)
      ctx.stroke()
    }

    const mapTexture = new THREE.CanvasTexture(mapCanvas)
    mapTexture.magFilter = THREE.LinearFilter

    const mapMaterial = new THREE.MeshPhongMaterial({
      map: mapTexture,
      emissive: 0x0f1a2e,
      emissiveIntensity: 0.2,
    })
    const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
    mapMesh.receiveShadow = true
    mapMesh.position.z = -5
    scene.add(mapMesh)

    // Heatmap group
    const heatmapGroup = new THREE.Group()
    scene.add(heatmapGroup)

    // Create heatmap particles from disruptions
    const updateHeatmap = () => {
      // Clear previous heatmap
      heatmapGroup.clear()

      if (disruptions.length === 0) return

      // Collect disruption points
      const points: DisruptionPoint[] = disruptions.map((disruption) => {
        const location = randomPointNearby(TORONTO_LAT, TORONTO_LON, 250)
        const planePos = latLonToPlane(location.lat, location.lon)

        const severityIntensity: Record<string, number> = {
          severe: 1.0,
          moderate: 0.6,
          minor: 0.3,
        }

        return {
          position: new THREE.Vector3(planePos.x, 15, planePos.y),
          severity: disruption.severity as 'severe' | 'moderate' | 'minor',
          intensity: severityIntensity[disruption.severity] ?? 0.5,
        }
      })

      // Create heatmap using particles with gaussian falloff
      const particleCount = points.length * 20
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(particleCount * 3)
      const colors = new Float32Array(particleCount * 3)
      const sizes = new Float32Array(particleCount)

      let index = 0

      // Color palette for severity
      const severityColors = {
        severe: { r: 1.0, g: 0.26, b: 0.26 },
        moderate: { r: 1.0, g: 0.66, b: 0.0 },
        minor: { r: 0.26, g: 1.0, b: 0.26 },
      }

      points.forEach((point) => {
        const color = severityColors[point.severity]
        const spreadRadius = 100

        // Create gaussian distribution around each point
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2
          const distance = Math.random() * spreadRadius * point.intensity
          const x = point.position.x + Math.cos(angle) * distance
          const y = point.position.y
          const z = point.position.z + Math.sin(angle) * distance

          positions[index * 3] = x
          positions[index * 3 + 1] = y
          positions[index * 3 + 2] = z

          // Fade out at distance
          const distanceFade = 1 - distance / (spreadRadius * point.intensity)

          colors[index * 3] = color.r
          colors[index * 3 + 1] = color.g
          colors[index * 3 + 2] = color.b

          sizes[index] = (20 * distanceFade * point.intensity) / 2

          index++
        }
      })

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

      const material = new THREE.PointsMaterial({
        size: 1,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      })

      const particles = new THREE.Points(geometry, material)
      heatmapGroup.add(particles)

      // Also add bright core markers at each disruption point
      points.forEach((point) => {
        const color = severityColors[point.severity]
        const coreGeometry = new THREE.SphereGeometry(3, 8, 8)
        const coreMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color.r, color.g, color.b),
        })
        const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial)
        coreMesh.position.copy(point.position)
        heatmapGroup.add(coreMesh)

        // Glow effect with larger sphere
        const glowGeometry = new THREE.SphereGeometry(12, 8, 8)
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color.r, color.g, color.b),
          transparent: true,
          opacity: 0.15,
        })
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
        glowMesh.position.copy(point.position)
        heatmapGroup.add(glowMesh)
      })
    }

    updateHeatmap()

    // Animation loop
    let animationId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const delta = clock.getDelta()

      controls.update()

      // Subtle animation of particles
      heatmapGroup.children.forEach((child) => {
        if (child instanceof THREE.Points) {
          child.rotation.z += delta * 0.05
        }
      })

      renderer.render(scene, camera)
    }

    animate()

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // Update heatmap when disruptions change
    updateHeatmap()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [disruptions])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}
