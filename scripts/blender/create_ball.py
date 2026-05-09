#!/usr/bin/env python3
"""
Create a simple ball in Blender via Python API.

Usage (from command line):
  blender --background --python scripts/blender/create_ball.py -- <out_dir> <name> <radius_meters>

Example:
  blender --background --python scripts/blender/create_ball.py -- ./assets Ball_v1 0.05

Note: This script must be run inside Blender's bundled Python (i.e., via the `blender` executable).
"""
import sys
import os


def main():
    # Blender passes args after '--' in sys.argv
    argv = sys.argv[:]
    if "--" in argv:
        idx = argv.index("--")
        args = argv[idx + 1 :]
    else:
        args = []

    out_dir = args[0] if len(args) >= 1 else os.getcwd()
    name = args[1] if len(args) >= 2 else "Ball_v1"
    try:
        radius = float(args[2]) if len(args) >= 3 else 0.05
    except Exception:
        radius = 0.05

    # Ensure output directory exists
    os.makedirs(out_dir, exist_ok=True)

    try:
        import bpy

        # Clean the scene
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)

        # Add UV sphere
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=radius, segments=64, ring_count=32, location=(0, 0, 0)
        )
        obj = bpy.context.active_object

        # Smooth shading
        bpy.ops.object.shade_smooth()

        # Create basic diffuse Principled BSDF material (light gray, matte)
        mat = bpy.data.materials.new(name="Ball_Material")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            bsdf.inputs.get("Base Color").default_value = (0.9, 0.9, 0.9, 1.0)
            bsdf.inputs.get("Roughness").default_value = 0.6
            bsdf.inputs.get("Metallic").default_value = 0.0

        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)

        # Save .blend
        blend_path = os.path.join(out_dir, f"{name}.blend")
        bpy.ops.wm.save_mainfile(filepath=blend_path)

        # Export GLB
        glb_path = os.path.join(out_dir, f"{name}.glb")
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB")

        # Add a simple camera if none exists (needed for headless rendering)
        import mathutils

        scene = bpy.context.scene
        if not scene.camera:
            cam_data = bpy.data.cameras.new(name="Camera")
            cam_obj = bpy.data.objects.new("Camera", cam_data)
            bpy.context.collection.objects.link(cam_obj)
            # Place camera behind and above the object
            cam_obj.location = (0.0, -radius * 4.0, radius * 1.5)
            direction = mathutils.Vector((0.0, 0.0, 0.0)) - cam_obj.location
            cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
            scene.camera = cam_obj

        # Add a simple area light for consistent preview lighting
        light_data = bpy.data.lights.new(name="KeyLight", type='AREA')
        light_data.energy = 500.0
        light_obj = bpy.data.objects.new(name="KeyLight", object_data=light_data)
        bpy.context.collection.objects.link(light_obj)
        light_obj.location = (radius * 2.0, -radius * 2.0, radius * 3.0)
        light_data.size = max(0.1, radius)

        # Ensure a known render engine and output settings
        try:
            scene.render.engine = 'BLENDER_EEVEE'
        except Exception:
            pass

        # Render a quick preview image (guarded)
        img_path = os.path.join(out_dir, f"{name}_preview.png")
        scene.render.image_settings.file_format = 'PNG'
        scene.render.filepath = img_path
        try:
            bpy.ops.render.render(write_still=True)
        except Exception as e:
            print("Warning: preview render failed:", e)

        print("Created:")
        print("  BLEND:", blend_path)
        print("  GLB:  ", glb_path)
        print("  IMG:  ", img_path)

    except ModuleNotFoundError:
        print("This script must be executed inside Blender (use the 'blender' executable).")
        sys.exit(2)
    except Exception as e:
        print("Error while creating ball:", e)
        raise


if __name__ == "__main__":
    main()
