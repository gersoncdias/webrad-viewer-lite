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

    let series = study.series.find(
      (item) => item.seriesInstanceUID === instance.seriesInstanceUID
    )

    if (!series) {
      series = {
        seriesInstanceUID: instance.seriesInstanceUID,
        seriesNumber: instance.seriesNumber,
        seriesDescription: instance.seriesDescription,
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
      series.instances.sort((left, right) => {
        const leftInstance = left.instanceNumber ?? Number.MAX_SAFE_INTEGER
        const rightInstance = right.instanceNumber ?? Number.MAX_SAFE_INTEGER
        return leftInstance - rightInstance || left.imageId.localeCompare(right.imageId)
      })
    }
  }

  return studies
}

function compareSeries(left: DicomSeries, right: DicomSeries) {
  const leftNumber = left.seriesNumber ?? Number.MAX_SAFE_INTEGER
  const rightNumber = right.seriesNumber ?? Number.MAX_SAFE_INTEGER
  return leftNumber - rightNumber || left.seriesInstanceUID.localeCompare(right.seriesInstanceUID)
}
