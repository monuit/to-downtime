import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useDisruptionStore } from '../store/disruptions'

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const disruptions = useDisruptionStore((state) => state.disruptions)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e27)
    scene.fog = new THREE.Fog(0x0a0e27, 100, 1000)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 15)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)

    // Create transit network visualization
    const createNetworkVisualization = () => {
      const group = new THREE.Group()

      // Create a grid of nodes representing transit stations
      const nodes = []
      for (let x = -8; x <= 8; x += 4) {
        for (let y = -6; y <= 6; y += 4) {
          const geometry = new THREE.SphereGeometry(0.2, 32, 32)
          const material = new THREE.MeshPhongMaterial({ color: 0x00ff88 })
          const node = new THREE.Mesh(geometry, material)
          node.position.set(x, y, 0)
          group.add(node)
          nodes.push(node)
        }
      }

      // Create connections between nodes
      const lineGeometry = new THREE.BufferGeometry()
      const points: THREE.Vector3[] = []

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dist = nodes[i].position.distanceTo(nodes[j].position)
          if (dist < 6 && dist > 0.1) {
            points.push(nodes[i].position)
            points.push(nodes[j].position)
          }
        }
      }

      lineGeometry.setFromPoints(points)
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 2 })
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
      group.add(lines)

      return group
    }

    // Create disruption indicators
    const createDisruptionIndicators = () => {
      const group = new THREE.Group()

      disruptions.forEach((disruption, index) => {
        const angle = (index / disruptions.length) * Math.PI * 2
        const radius = 5 + Math.sin(angle * 3) * 2

        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius

        const color =
          disruption.severity === 'severe'
            ? 0xff3333
            : disruption.severity === 'moderate'
              ? 0xffaa00
              : 0xffdd00

        const geometry = new THREE.SphereGeometry(0.4, 32, 32)
        const material = new THREE.MeshPhongMaterial({ color })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, 2)

        // Add pulsing animation data
        ;(mesh as any).velocity = Math.random() * 0.02 + 0.01

        group.add(mesh)
      })

      return group
    }

    const networkGroup = createNetworkVisualization()
    scene.add(networkGroup)

    let disruptionGroup = createDisruptionIndicators()
    scene.add(disruptionGroup)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 0.8)
    pointLight.position.set(10, 10, 10)
    scene.add(pointLight)

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Rotate network
      networkGroup.rotation.z += 0.0005

      // Animate disruption indicators
      disruptionGroup.children.forEach((child: any) => {
        child.position.z += child.velocity
        child.rotation.x += 0.02
        child.rotation.y += 0.02

        if (child.position.z > 4) child.velocity = -Math.abs(child.velocity)
        if (child.position.z < 0) child.velocity = Math.abs(child.velocity)

        // Pulse effect
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 0.9
        child.scale.set(pulse, pulse, pulse)
      })

      renderer.render(scene, camera)
    }
    animate()

    // Update disruption group when data changes
    const updateDisruptions = () => {
      scene.remove(disruptionGroup)
      disruptionGroup = createDisruptionIndicators()
      scene.add(disruptionGroup)
    }

    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)
    const updateInterval = setInterval(updateDisruptions, 1000)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearInterval(updateInterval)
      cancelAnimationFrame(animationId)
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [disruptions])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
