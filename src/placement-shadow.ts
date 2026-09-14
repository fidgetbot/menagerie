import * as THREE from 'three';

/** A top-down silhouette projected onto existing receiver surfaces, without relighting them. */
export class PlacementShadow {
  private target = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: true });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-4.5, 4.5, 4.5, -4.5, 0.1, 100);
  private bounds = new THREE.Box3();
  private materials = new Set<THREE.Material>();
  private uniforms = {
    placementMap: { value: this.target.texture },
    placementStrength: { value: 0 },
    placementCeiling: { value: 0 },
  };

  constructor() {
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    this.camera.up.set(0, 1, 0);
  }

  receive(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.materials.has(material)) continue;
        this.materials.add(material);
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, this.uniforms);
          shader.vertexShader = 'varying vec3 placementWorld;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nplacementWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          shader.fragmentShader = `
            uniform sampler2D placementMap;
            uniform float placementStrength;
            uniform float placementCeiling;
            varying vec3 placementWorld;
          ` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
            if (placementStrength > 0.0 && placementWorld.z < placementCeiling) {
              vec2 uv = placementWorld.xy / 9.0 + 0.5;
              if (all(greaterThan(uv, vec2(0.01))) && all(lessThan(uv, vec2(0.99)))) {
                float footprint = 0.0;
                for (int x = -1; x <= 1; x++) {
                  for (int y = -1; y <= 1; y++) {
                    footprint += 1.0 - texture2D(placementMap, uv + vec2(float(x), float(y)) * 0.003).r;
                  }
                }
                outgoingLight *= 1.0 - placementStrength * footprint / 9.0;
              }
            }
            #include <opaque_fragment>
          `);
        };
        material.customProgramCacheKey = () => 'placement-shadow-v1';
        material.needsUpdate = true;
      }
    });
  }

  render(renderer: THREE.WebGLRenderer, held: THREE.Object3D | null) {
    this.uniforms.placementStrength.value = 0;
    if (!held) return;
    held.updateWorldMatrix(true, true);
    this.bounds.setFromObject(held);
    this.uniforms.placementCeiling.value = this.bounds.min.z - 0.02;
    this.camera.position.set(0, 0, this.bounds.max.z + 10);
    this.camera.lookAt(0, 0, this.bounds.min.z);
    const parent = held.parent!;
    const previousTarget = renderer.getRenderTarget();
    // Render the actual animated geometry, using a black override material on white.
    this.scene.add(held);
    try {
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
    } finally {
      parent.add(held);
      renderer.setRenderTarget(previousTarget);
    }
    this.uniforms.placementStrength.value = 0.48;
  }
}
