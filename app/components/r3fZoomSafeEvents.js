import { events } from '@react-three/fiber'

// React Three Fiber's default pointer mapping divides event.offsetX by the
// canvas size it measured. On wide screens the topic column is enlarged with
// CSS zoom (topics/layout.module.css), and under zoom those two numbers come
// in different units (offsetX in zoomed pixels, the measured size in layout
// pixels), so clicks would land in the wrong place in the 3D scene.
//
// This keeps R3F's default event manager and replaces only the mapping: the
// pointer position and the canvas size are both read from the canvas's
// on-screen rectangle, so zoom cancels out of the division. With no zoom it
// gives exactly the same result as the default.
export function zoomSafeEvents(store) {
  return {
    ...events(store),
    compute(event, state) {
      const rect = state.gl.domElement.getBoundingClientRect()
      state.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      state.raycaster.setFromCamera(state.pointer, state.camera)
    },
  }
}
