/**
 * Instanced Pings System
 * Renders thousands of animated pings efficiently using InstancedMesh
 */

import * as THREE from 'three'

// Vertex shader for instanced pings
const PING_VERTEX = `
  attribute float phase;
  attribute float intensity;
  
  uniform float uTime;
  uniform float uPulseSpeed;
  
  varying float vAlpha;
  varying float vIntensity;
  
  void main() {
    // Per-instance phase offset for staggered animation
    float localTime = mod(uTime * uPulseSpeed + phase, 1.0);
    
    // Pulse curve: fade in → peak → fade out
    float pulse = sin(localTime * 3.14159) * intensity;
    vAlpha = pulse * 0.8;
    vIntensity = intensity;
    
    // Scale pulsation (grows as it fades)
    float scale = 1.0 + localTime * 0.5;
    vec3 pos = position * scale;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// Fragment shader for instanced pings
const PING_FRAGMENT = `
  varying float vAlpha;
  varying float vIntensity;
  
  void main() {
    // Soft circular glow
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    float circle = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Color based on intensity (green → yellow → red)
    vec3 color;
    if (vIntensity < 0.33) {
      color = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 1.0, 0.0), vIntensity * 3.0);
    } else {
      color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.2, 0.0), (vIntensity - 0.33) * 1.5);
    }
    
    gl_FragColor = vec4(color, circle * vAlpha);
  }
`

export interface PingData {
  position: THREE.Vector3
  phase: number
  intensity: number // 0-1
}

export class PingsSystem {
  private mesh: THREE.InstancedMesh
  private material: THREE.ShaderMaterial
  private pings: PingData[] = []
  private phaseAttribute: THREE.BufferAttribute
  private intensityAttribute: THREE.BufferAttribute

  constructor(maxPings: number = 5000) {
    // Create geometry (small sphere)
    const geometry = new THREE.SphereGeometry(1, 8, 8)

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: PING_VERTEX,
      fragmentShader: PING_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPulseSpeed: { value: 2.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Create instanced mesh
    this.mesh = new THREE.InstancedMesh(geometry, this.material, maxPings)

    // Add custom attributes for phase and intensity
    this.phaseAttribute = new THREE.BufferAttribute(new Float32Array(maxPings), 1)
    this.intensityAttribute = new THREE.BufferAttribute(new Float32Array(maxPings), 1)

    geometry.setAttribute('phase', this.phaseAttribute)
    geometry.setAttribute('intensity', this.intensityAttribute)

    // Initialize matrices
    const dummy = new THREE.Object3D()
    for (let i = 0; i < maxPings; i++) {
      dummy.position.set(0, 0, 0)
      dummy.scale.set(0, 0, 0) // Start invisible
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  addPing(data: PingData, index: number) {
    const dummy = new THREE.Object3D()
    dummy.position.copy(data.position)
    dummy.scale.set(3, 3, 3) // Small pings
    dummy.updateMatrix()

    this.mesh.setMatrixAt(index, dummy.matrix)

    // Set per-instance attributes
    this.phaseAttribute.setXY(index, data.phase, 0)
    this.intensityAttribute.setXY(index, data.intensity, 0)

    this.pings[index] = data
  }

  updatePings(pings: PingData[]) {
    const dummy = new THREE.Object3D()

    for (let i = 0; i < pings.length && i < this.mesh.count; i++) {
      const ping = pings[i]
      dummy.position.copy(ping.position)
      dummy.scale.set(3, 3, 3)
      dummy.updateMatrix()

      this.mesh.setMatrixAt(i, dummy.matrix)
      this.phaseAttribute.setXY(i, ping.phase, 0)
      this.intensityAttribute.setXY(i, ping.intensity, 0)
    }

    // Hide unused instances
    for (let i = pings.length; i < this.mesh.count; i++) {
      dummy.position.set(0, 0, 0)
      dummy.scale.set(0, 0, 0)
      dummy.updateMatrix()
      this.mesh.setMatrixAt(i, dummy.matrix)
    }

    this.mesh.instanceMatrix.needsUpdate = true
    this.phaseAttribute.needsUpdate = true
    this.intensityAttribute.needsUpdate = true
  }

  update(deltaTime: number) {
    const time = (this.material.uniforms as any).uTime.value
    ;(this.material.uniforms as any).uTime.value = time + deltaTime
  }

  getMesh(): THREE.InstancedMesh {
    return this.mesh
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
