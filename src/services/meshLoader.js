import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createAeroMaterial } from './proceduralCar';

/**
 * Loads a real 3D mesh file (.obj, .stl, .gltf, .glb) into a Three.js Group
 * Calculates real bounding box, center, triangle count, and surface area.
 */
export async function loadMeshFromFile(file, shadingMode = 'aero_pressure') {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.stl')) {
      reader.onload = (e) => {
        try {
          const contents = e.target.result;
          const loader = new STLLoader();
          const geometry = loader.parse(contents);
          geometry.computeVertexNormals();
          geometry.center();

          const material = createAeroMaterial({
            baseColor: 0x27272a,
            roughness: 0.35,
            metalness: 0.7,
            shadingMode
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = file.name;

          const group = new THREE.Group();
          group.name = 'Imported_STL_Model';
          group.add(mesh);
          normalizeMeshGroup(group);

          const stats = calculateMeshStats(geometry);
          resolve({ group, stats, fileType: 'STL' });
        } catch (err) {
          reject(new Error(`Failed to parse STL: ${err.message}`));
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.obj')) {
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const loader = new OBJLoader();
          const group = loader.parse(text);

          const defaultMaterial = createAeroMaterial({
            baseColor: 0x27272a,
            roughness: 0.35,
            metalness: 0.7,
            shadingMode
          });

          let totalTris = 0;
          group.traverse((child) => {
            if (child.isMesh) {
              child.material = defaultMaterial;
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.geometry) {
                child.geometry.computeVertexNormals();
                const pos = child.geometry.attributes.position;
                if (pos) totalTris += pos.count / 3;
              }
            }
          });

          normalizeMeshGroup(group);
          group.name = 'Imported_OBJ_Model';
          const bbox = new THREE.Box3().setFromObject(group);
          const size = bbox.getSize(new THREE.Vector3());
          resolve({
            group,
            stats: {
              triangles: Math.round(totalTris),
              width: Number(size.x.toFixed(2)),
              height: Number(size.y.toFixed(2)),
              length: Number(size.z.toFixed(2)),
              frontalArea: Number((size.x * size.y * 0.82).toFixed(2))
            },
            fileType: 'OBJ'
          });
        } catch (err) {
          reject(new Error(`Failed to parse OBJ: ${err.message}`));
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
      reader.onload = (e) => {
        try {
          const contents = e.target.result;
          const loader = new GLTFLoader();
          loader.parse(
            contents,
            '',
            (gltf) => {
              const group = gltf.scene || gltf.scenes[0];
              const defaultMaterial = createAeroMaterial({
                baseColor: 0x27272a,
                roughness: 0.35,
                metalness: 0.7,
                shadingMode
              });

              let totalTris = 0;
              group.traverse((child) => {
                if (child.isMesh) {
                  child.material = defaultMaterial;
                  child.castShadow = true;
                  child.receiveShadow = true;
                  if (child.geometry) {
                    const pos = child.geometry.attributes.position;
                    if (pos) totalTris += pos.count / 3;
                  }
                }
              });

              normalizeMeshGroup(group);
              group.name = 'Imported_GLTF_Model';
              const bbox = new THREE.Box3().setFromObject(group);
              const size = bbox.getSize(new THREE.Vector3());
              resolve({
                group,
                stats: {
                  triangles: Math.round(totalTris),
                  width: Number(size.x.toFixed(2)),
                  height: Number(size.y.toFixed(2)),
                  length: Number(size.z.toFixed(2)),
                  frontalArea: Number((size.x * size.y * 0.82).toFixed(2))
                },
                fileType: 'GLTF'
              });
            },
            (err) => reject(new Error(`Failed to parse GLTF: ${err.message}`))
          );
        } catch (err) {
          reject(new Error(`Failed to parse GLTF/GLB: ${err.message}`));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported 3D file format. Please upload .STL, .OBJ, .GLTF, or .GLB`));
    }
  });
}

function normalizeMeshGroup(group) {
  const bbox = new THREE.Box3().setFromObject(group);
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim > 12.0 || maxDim < 0.5) {
    const targetDim = 4.2;
    const scaleFactor = targetDim / (maxDim || 1);
    group.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }

  const updatedBox = new THREE.Box3().setFromObject(group);
  const center = updatedBox.getCenter(new THREE.Vector3());
  group.position.x = -center.x;
  group.position.z = -center.z;
  group.position.y = -updatedBox.min.y + 0.05;
}

function calculateMeshStats(geometry) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = bbox.getSize(new THREE.Vector3());
  const pos = geometry.attributes.position;
  const triangles = pos ? Math.round(pos.count / 3) : 0;

  return {
    triangles,
    width: Number(size.x.toFixed(2)),
    height: Number(size.y.toFixed(2)),
    length: Number(size.z.toFixed(2)),
    frontalArea: Number((size.x * size.y * 0.82).toFixed(2))
  };
}
