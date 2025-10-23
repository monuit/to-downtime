/**
 * Ripple Rings System
 * Animated concentric rings centered on Toronto with GSAP
 */

import * as THREE from 'three'
import gsap from 'gsap'

// Fragment shader for ripple rings
const RIPPLE_FRAGMENT = `
  uniform float uTime;
  uniform float uRadius;
  uniform float uIntensity;
  
  varying vec2 vUv;
  
  void main() {
    // Distance from center
    float dist = length(vUv - vec2(0.5));
    
    // Create concentric rings with fade
    float ring = sin((dist - uTime * 2.0) * 20.0) * 0.5 + 0.5;
    ring *= smoothstep(uRadius * 1.2, uRadius * 0.8, dist);
    
    // Color based on intensity (cyan → white)
    vec3 color = mix(vec3(0.0, 1.0, 1.0), vec3(1.0), uIntensity);
    
    gl_FragColor = vec4(color, ring * uIntensity * 0.6);
  }
`

const RIPPLE_VERTEX = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export class RippleRingsSystem {
  private group: THREE.Group = new THREE.Group()
  private rings: THREE.Mesh[] = []
  private timelines: gsap.core.Timeline[] = []

  constructor() {
    // Create up to 5 concentric ring layers
    const ringCount = 5
    const maxRadius = 100

    for (let i = 0; i < ringCount; i++) {
      const geometry = new THREE.PlaneGeometry(maxRadius * 2, maxRadius * 2, 32, 32)

      const material = new THREE.ShaderMaterial({
        vertexShader: RIPPLE_VERTEX,
        fragmentShader: RIPPLE_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: 0.3 },
          uIntensity: { value: 0.5 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.z = 1 + i * 0.1 // Slight depth offset
      this.group.add(mesh)
      this.rings.push(mesh)

      // Create GSAP timeline for this ring
      const timeline = gsap.timeline({ repeat: -1 })
      timeline.to(
        (material.uniforms as any).uRadius,
        {
          value: 2.0,
          duration: 2.0,
          ease: 'power1.out',
        },
        0
      )
      timeline.to(
        (material.uniforms as any).uIntensity,
        {
          value: 0,
          duration: 2.0,
          ease: 'power1.out',
        },
        0
      )

      // Stagger start times
      timeline.delay(i * 0.3)
      this.timelines.push(timeline)
    }
  }

  /**
   * Trigger an alert burst (increase frequency and intensity)
   */
  triggerAlert(duration: number = 1.5) {
    this.rings.forEach((mesh, i) => {
      const material = mesh.material as THREE.ShaderMaterial
      gsap.to((material.uniforms as any).uIntensity, {
        value: 1.0,
        duration: duration * 0.5,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to((material.uniforms as any).uIntensity, {
            value: 0.5,
            duration: duration * 0.5,
            ease: 'power2.in',
          })
        },
      })
    })
  }

  /**
   * Update ripple based on disruption intensity
   */
  setIntensity(intensity: number) {
    // Clamp 0-1
    const normalized = Math.max(0, Math.min(1, intensity))

    // Scale pulse speed based on intensity
    const pulseSpeed = 1.0 + normalized * 2.0
    this.rings.forEach((mesh) => {
      const material = mesh.material as THREE.ShaderMaterial
      ;(material.uniforms as any).uIntensity.value = normalized * 0.8
    })

    // Speed up timelines
    this.timelines.forEach((tl) => {
      tl.timeScale(pulseSpeed)
    })
  }

  update(deltaTime: number) {
    this.rings.forEach((mesh) => {
      const material = mesh.material as THREE.ShaderMaterial
      ;(material.uniforms as any).uTime.value += deltaTime
    })
  }

  getGroup(): THREE.Group {
    return this.group
  }

  dispose() {
    this.timelines.forEach((tl) => tl.kill())
    this.rings.forEach((mesh) => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    })
  }
}
