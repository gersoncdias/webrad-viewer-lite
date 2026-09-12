import { metaData } from "@cornerstonejs/core"
import type { DicomInstance } from "../dicom/types"

const instanceByImageId = new Map<string, DicomInstance>()
let providerRegistered = false

export function cacheLocalMetadata(instances: DicomInstance[]) {
  for (const instance of instances) {
    instanceByImageId.set(instance.imageId, instance)
  }
}

export function clearLocalMetadata() {
  instanceByImageId.clear()
}

export function registerLocalMetadataProvider() {
  if (providerRegistered) {
    return
  }

  metaData.addProvider(localMetadataProvider, 10000)
  providerRegistered = true
}

function localMetadataProvider(type: string, imageId: string) {
  const instance = instanceByImageId.get(imageId)
  if (!instance) {
    return undefined
  }

  if (type === "imagePlaneModule") {
    const pixelSpacing = instance.pixelSpacing ?? [1, 1]
    const orientation = instance.imageOrientationPatient ?? [1, 0, 0, 0, 1, 0]

    return {
      frameOfReferenceUID: instance.frameOfReferenceUID ?? "LOCAL_FRAME",
      rows: instance.rows,
      columns: instance.columns,
      imageOrientationPatient: orientation,
      rowCosines: orientation.slice(0, 3),
      columnCosines: orientation.slice(3, 6),
      imagePositionPatient: instance.imagePositionPatient ?? [0, 0, instance.instanceNumber ?? 0],
      sliceThickness: instance.sliceThickness ?? 1,
      sliceLocation: instance.sliceLocation,
      pixelSpacing,
      rowPixelSpacing: pixelSpacing[0] ?? 1,
      columnPixelSpacing: pixelSpacing[1] ?? 1,
    }
  }

  if (type === "imagePixelModule") {
    return {
      samplesPerPixel: instance.samplesPerPixel ?? 1,
      photometricInterpretation: instance.photometricInterpretation ?? "MONOCHROME2",
      rows: instance.rows,
      columns: instance.columns,
      bitsAllocated: instance.bitsAllocated ?? 16,
      bitsStored: instance.bitsStored ?? instance.bitsAllocated ?? 16,
      highBit: instance.highBit ?? (instance.bitsStored ?? instance.bitsAllocated ?? 16) - 1,
      pixelRepresentation: instance.pixelRepresentation ?? 0,
    }
  }

  if (type === "generalSeriesModule") {
    return {
      modality: "CT",
    }
  }

  if (type === "modalityLutModule") {
    return {
      rescaleIntercept: instance.rescaleIntercept ?? 0,
      rescaleSlope: instance.rescaleSlope ?? 1,
      rescaleType: "HU",
    }
  }

  if (type === "voiLutModule") {
    return {
      windowCenter: instance.windowCenter,
      windowWidth: instance.windowWidth,
    }
  }

  return undefined
}
