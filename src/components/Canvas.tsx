import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import { useDisruptionStore } from '../store/disruptions'
import { latLonToPlane, TORONTO_LAT, TORONTO_LON, randomPointNearby } from '../utils/mercator'
import { PingsSystem } from '../utils/pingsSystem'
import { RippleRingsSystem } from '../utils/ripplesSystem'

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const disruptions = useDisruptionStore((state) => state.disruptions)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e27)
    scene.fog = new THREE.Fog(0x0a0e27, 500, 2000)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    )

    const torontoPosPlane = latLonToPlane(TORONTO_LAT, TORONTO_LON)
    camera.position.set(torontoPosPlane.x, 150, torontoPosPlane.y + 120)
    camera.lookAt(torontoPosPlane.x, 0, torontoPosPlane.y)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    containerRef.current.appendChild(renderer.domElement)

    // Orbit controls for pan/zoom
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3
    controls.minDistance = 50
    controls.maxDistance = 800
    controls.target.set(torontoPosPlane.x, 0, torontoPosPlane.y)
    controls.update()

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight.position.set(300, 400, 300)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.left = -500
    directionalLight.shadow.camera.right = 500
    directionalLight.shadow.camera.top = 500
    directionalLight.shadow.camera.bottom = -500
    scene.add(directionalLight)

    // Mercator map plane
    const mapGeometry = new THREE.PlaneGeometry(4096, 2048)
    const mapCanvas = document.createElement('canvas')
    mapCanvas.width = 1024
    mapCanvas.height = 512
    const ctx = mapCanvas.getContext('2d')!

    // Create gradient map texture
    const gradient = ctx.createLinearGradient(0, 0, 1024, 512)
    gradient.addColorStop(0, '#1a3a5c')
    gradient.addColorStop(0.5, '#2d5a8c')
    gradient.addColorStop(1, '#1a3a5c')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1024, 512)

    // Add some landmass-like patterns
    ctx.fillStyle = '#0f2540'
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 1024
      const y = Math.random() * 512
      const size = Math.random() * 80 + 20
      ctx.fillRect(x, y, size, size)
    }

    const mapTexture = new THREE.CanvasTexture(mapCanvas)
    mapTexture.magFilter = THREE.LinearFilter

    const mapMaterial = new THREE.MeshPhongMaterial({
      map: mapTexture,
      emissive: 0x1a4a6c,
      emissiveIntensity: 0.3,
    })
    const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
    mapMesh.receiveShadow = true
    mapMesh.position.z = -1
    scene.add(mapMesh)

    // Ripple rings (Toronto-centered anomaly)
    const ripplesSystem = new RippleRingsSystem()
    ripplesSystem.getGroup().position.set(torontoPosPlane.x, 0, torontoPosPlane.y)
    scene.add(ripplesSystem.getGroup())

    // Pings system (disruption indicators)
    const pingsSystem = new PingsSystem(5000)
    scene.add(pingsSystem.getMesh())

    // Cinematic opening timeline
    const openingTL = gsap.timeline()
    openingTL.to(
      camera.position,
      {
        x: torontoPosPlane.x,
        y: 120,
        z: torontoPosPlane.y + 100,
        duration: 3.5,
        ease: 'power2.inOut',
      },
      0
    )
    openingTL.to(
      ambientLight,
      {
        intensity: 0.8,
        duration: 2,
        ease: 'power1.inOut',
      },
      0.5
    )

    // Update disruptions as pings on the map
    const updateDisruptions = () => {
      const activePings: Array<{
        position: THREE.Vector3
        phase: number
        intensity: number
      }> = []

      disruptions.forEach((disruption, index) => {
        // Place disruptions randomly within 200km of Toronto
        const location = randomPointNearby(TORONTO_LAT, TORONTO_LON, 200)
        const planePos = latLonToPlane(location.lat, location.lon)

        const severityMap: Record<string, number> = {
          severe: 1.0,
          moderate: 0.6,
          minor: 0.3,
        }

        activePings.push({
          position: new THREE.Vector3(planePos.x, 8, planePos.y),
          phase: Math.random(),
          intensity: severityMap[disruption.severity] ?? 0.5,
        })

        // Trigger alert on severe disruptions
        if (disruption.severity === 'severe' && index === 0) {
          ripplesSystem.triggerAlert(1.2)
        }
      })

      pingsSystem.updatePings(activePings)

      // Calculate and set ripple intensity
      const avgIntensity =
        disruptions.reduce((sum, d) => {
          return (
            sum +
            (d.severity === 'severe' ? 1.0 : d.severity === 'moderate' ? 0.6 : 0.3)
          )
        }, 0) / Math.max(disruptions.length, 1)

      ripplesSystem.setIntensity(avgIntensity)
    }

    updateDisruptions()

    // Animation loop
    let animationId: number
    const clock = new THREE.Clock()

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const delta = clock.getDelta()

      controls.update()
      pingsSystem.update(delta)
      ripplesSystem.update(delta)

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

    // Update on disruption changes
    updateDisruptions()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      pingsSystem.dispose()
      ripplesSystem.dispose()
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
