/**
 * Temporarily repositions the 3D camera directly overhead, renders one frame,
 * reads it back as a data URL, then restores the camera exactly as it was.
 * Used both for floorplan save-thumbnails (whole flat) and the Export dialog
 * (whole flat or a single room) — pass `bounds` to scope it to a room.
 *
 * @param {object} blueprint3d
 * @param {object} [options]
 * @param {{x:number,z:number}} [options.center] - plan-space center to look at; defaults to the whole floorplan's center
 * @param {{x:number,z:number}} [options.size] - plan-space width/depth to fit in frame; defaults to the whole floorplan's size
 * @param {number} [options.targetWidth]
 * @param {number} [options.targetHeight]
 * @param {number} [options.margin] - multiplier applied to `size` so the frame isn't edge-to-edge
 * @param {string} [options.format]
 * @param {number} [options.quality]
 * @returns {string} a data: URL of the rendered snapshot, or '' if the engine isn't ready
 */
export function captureTopDownSnapshot(blueprint3d, options = {}) {
  if (!blueprint3d) return ''

  const {
    center = null,
    size = null,
    targetWidth = 1200,
    targetHeight = 900,
    margin = 1.4,
    format = 'image/webp',
    quality = 0.85
  } = options

  const three = blueprint3d.three
  const { camera, controls, renderer } = three

  const savedPosition = camera.position.clone()
  const savedTarget = controls.target.clone()
  const savedRotation = camera.rotation.clone()
  const savedAspect = camera.aspect
  const canvas = renderer.domElement
  const savedWidth = canvas.width
  const savedHeight = canvas.height

  try {
    renderer.setSize(targetWidth, targetHeight, false)
    camera.aspect = targetWidth / targetHeight
    camera.updateProjectionMatrix()

    const frameCenter = center || blueprint3d.model.floorplan.getCenter()
    const frameSize = size || blueprint3d.model.floorplan.getSize()
    const targetAspect = targetWidth / targetHeight
    const boundsAspect = frameSize.x / frameSize.z

    let viewWidth, viewHeight
    if (boundsAspect > targetAspect) {
      viewWidth = frameSize.x * margin
      viewHeight = viewWidth / targetAspect
    } else {
      viewHeight = frameSize.z * margin
      viewWidth = viewHeight * targetAspect
    }

    const fov = camera.fov * (Math.PI / 180)
    const distance = Math.max(viewWidth, viewHeight) / (2 * Math.tan(fov / 2))

    controls.target.set(frameCenter.x, 0, frameCenter.z)
    camera.position.set(frameCenter.x, distance, frameCenter.z)
    camera.lookAt(controls.target)
    camera.updateProjectionMatrix()
    controls.update()

    renderer.clear()
    renderer.render(three.scene.getScene(), camera)

    return canvas.toDataURL(format, quality)
  } finally {
    renderer.setSize(savedWidth, savedHeight, false)
    camera.aspect = savedAspect
    camera.position.copy(savedPosition)
    controls.target.copy(savedTarget)
    camera.rotation.copy(savedRotation)
    camera.updateProjectionMatrix()
    controls.update()
    renderer.clear()
    renderer.render(three.scene.getScene(), camera)
  }
}
