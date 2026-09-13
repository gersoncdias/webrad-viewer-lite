import type { DicomSeries, DicomStudy } from "./types"
import type { ParsedDicomInstance } from "./parseDicomFiles"

export function groupStudies(instances: ParsedDicomInstance[]): DicomStudy[] {
  const studyMap = new Map<string, DicomStudy>()

  for (const instance of instances) {
    let study = studyMap.get(instance.studyInstanceUID)

    if (!study) {
      study = {
        studyInstanceUID: instance.studyInstanceUID,
        studyDate: instance.studyDate,
        studyDescription: instance.studyDescription,
        patient: {
          patientName: instance.patientName,
          patientID: instance.patientID,
          patientBirthDate: instance.patientBirthDate,
          patientSex: instance.patientSex,
        },
        series: [],
      }
      studyMap.set(instance.studyInstanceUID, study)
    }

    const seriesUID = getSeriesKey(instance)
    let series = study.series.find(
      (item) => item.seriesInstanceUID === seriesUID
    )

    if (!series) {
      series = {
        seriesInstanceUID: seriesUID,
        seriesNumber: instance.seriesNumber,
        seriesDescription: getSeriesDescription(instance),
        modality: instance.modality,
        instances: [],
      }
      study.series.push(series)
    }

    series.instances.push({
      file: instance.file,
      imageId: instance.imageId,
      sopInstanceUID: instance.sopInstanceUID,
      instanceNumber: instance.instanceNumber,
      rows: instance.rows,
      columns: instance.columns,
      bitsAllocated: instance.bitsAllocated,
      bitsStored: instance.bitsStored,
      highBit: instance.highBit,
      samplesPerPixel: instance.samplesPerPixel,
      pixelRepresentation: instance.pixelRepresentation,
      photometricInterpretation: instance.photometricInterpretation,
      pixelSpacing: instance.pixelSpacing,
      frameOfReferenceUID: instance.frameOfReferenceUID,
      sliceThickness: instance.sliceThickness,
      sliceLocation: instance.sliceLocation,
      rescaleIntercept: instance.rescaleIntercept,
      rescaleSlope: instance.rescaleSlope,
      windowCenter: instance.windowCenter,
      windowWidth: instance.windowWidth,
      imagePositionPatient: instance.imagePositionPatient,
      imageOrientationPatient: instance.imageOrientationPatient,
    })
  }

  const studies = Array.from(studyMap.values())

  for (const study of studies) {
    study.series.sort(compareSeries)
    for (const series of study.series) {
      series.instances.sort(compareInstances)
    }
  }

  return studies
}

function compareSeries(left: DicomSeries, right: DicomSeries) {
  const leftNumber = left.seriesNumber ?? Number.MAX_SAFE_INTEGER
  const rightNumber = right.seriesNumber ?? Number.MAX_SAFE_INTEGER
  return leftNumber - rightNumber || left.seriesInstanceUID.localeCompare(right.seriesInstanceUID)
}


function getSeriesKey(instance: ParsedDicomInstance) {
  return `${instance.seriesInstanceUID}|${orientationKey(instance.imageOrientationPatient)}`
}

function getSeriesDescription(instance: ParsedDicomInstance) {
  const description = instance.seriesDescription
  const orientation = orientationKey(instance.imageOrientationPatient)
  return orientation === "sem-orientacao" ? description : description
}

function orientationKey(orientation?: number[]) {
  if (!orientation || orientation.length < 6) {
    return "sem-orientacao"
  }

  return orientation.slice(0, 6).map((value) => value.toFixed(4)).join("|")
}

function compareInstances(left: DicomSeries["instances"][number], right: DicomSeries["instances"][number]) {
  const leftPosition = getSlicePosition(left.imageOrientationPatient, left.imagePositionPatient)
  const rightPosition = getSlicePosition(right.imageOrientationPatient, right.imagePositionPatient)

  if (leftPosition !== undefined && rightPosition !== undefined && leftPosition !== rightPosition) {
    return leftPosition - rightPosition
  }

  const leftInstance = left.instanceNumber ?? Number.MAX_SAFE_INTEGER
  const rightInstance = right.instanceNumber ?? Number.MAX_SAFE_INTEGER
  return leftInstance - rightInstance || left.imageId.localeCompare(right.imageId)
}

function getSlicePosition(orientation?: number[], position?: number[]) {
  if (!orientation || orientation.length < 6 || !position || position.length < 3) {
    return undefined
  }

  const row = orientation.slice(0, 3)
  const column = orientation.slice(3, 6)
  const normal = [
    row[1] * column[2] - row[2] * column[1],
    row[2] * column[0] - row[0] * column[2],
    row[0] * column[1] - row[1] * column[0],
  ]

  return normal[0] * position[0] + normal[1] * position[1] + normal[2] * position[2]
}
