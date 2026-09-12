import { init as initCornerstoneCore, setUseCPURendering } from "@cornerstonejs/core"
import { init as initDicomImageLoader } from "@cornerstonejs/dicom-image-loader"
import { registerLocalMetadataProvider } from "./localMetadataProvider"

let initPromise: Promise<void> | null = null

export function initCornerstone() {
  if (!initPromise) {
    initPromise = initialize()
  }

  return initPromise
}

async function initialize() {
  setUseCPURendering(true, false)
  await initCornerstoneCore()
  initDicomImageLoader({ maxWebWorkers: 1 })
  registerLocalMetadataProvider()
}
