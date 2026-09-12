import dicomParser from "dicom-parser"
import { addLocalDicomFile, purgeLocalDicomFiles } from "../cornerstone/localFileLoader"
import { cacheLocalMetadata, clearLocalMetadata } from "../cornerstone/localMetadataProvider"
import type { DicomInstance, DicomLoadProgress, DicomLoadResult, IgnoredDicomFile } from "./types"
import { groupStudies } from "./groupStudies"

const TAGS = {
  patientName: "x00100010",
  patientID: "x00100020",
  patientBirthDate: "x00100030",
  patientSex: "x00100040",
  studyInstanceUID: "x0020000d",
  studyDate: "x00080020",
  studyDescription: "x00081030",
  seriesInstanceUID: "x0020000e",
  seriesNumber: "x00200011",
  seriesDescription: "x0008103e",
  modality: "x00080060",
  instanceNumber: "x00200013",
  sopInstanceUID: "x00080018",
  frameOfReferenceUID: "x00200052",
  rows: "x00280010",
  columns: "x00280011",
  bitsAllocated: "x00280100",
  bitsStored: "x00280101",
  highBit: "x00280102",
  pixelRepresentation: "x00280103",
  samplesPerPixel: "x00280002",
  photometricInterpretation: "x00280004",
  pixelSpacing: "x00280030",
  sliceThickness: "x00180050",
  sliceLocation: "x00201041",
  rescaleIntercept: "x00281052",
  rescaleSlope: "x00281053",
  windowCenter: "x00281050",
  windowWidth: "x00281051",
  imagePositionPatient: "x00200032",
  imageOrientationPatient: "x00200037",
  pixelData: "x7fe00010",
}

export async function parseDicomFiles(
  files: File[],
  onProgress?: (progress: DicomLoadProgress) => void
): Promise<DicomLoadResult> {
  purgeLocalDicomFiles()
  clearLocalMetadata()

  const instances: ParsedDicomInstance[] = []
  const ignoredFiles: IgnoredDicomFile[] = []
  const progress: DicomLoadProgress = {
    analyzed: 0,
    total: files.length,
    loaded: 0,
    ignored: 0,
  }

  for (const file of files) {
    const parsed = await parseDicomFile(file)

    progress.analyzed += 1

    if ("instance" in parsed) {
      instances.push(parsed.instance)
      progress.loaded += 1
    } else {
      ignoredFiles.push({
        name: file.webkitRelativePath || file.name,
        reason: parsed.reason,
      })
      progress.ignored += 1
    }

    if (progress.analyzed % 25 === 0 || progress.analyzed === progress.total) {
      onProgress?.({ ...progress })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }
  }

  const studies = groupStudies(instances)
  cacheLocalMetadata(studies.flatMap((study) => study.series.flatMap((series) => series.instances)))

  return {
    studies,
    progress,
    ignoredFiles,
  }
}

export interface ParsedDicomInstance extends DicomInstance {
  patientName?: string
  patientID?: string
  patientBirthDate?: string
  patientSex?: string
  studyInstanceUID: string
  studyDate?: string
  studyDescription?: string
  seriesInstanceUID: string
  seriesNumber?: number
  seriesDescription?: string
  modality?: string
}

type ParseFileResult =
  | { instance: ParsedDicomInstance }
  | { reason: string }

async function parseDicomFile(file: File): Promise<ParseFileResult> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const byteArray = new Uint8Array(arrayBuffer)
    const dataSet = parseMetadata(byteArray)

    const studyInstanceUID = readString(dataSet, TAGS.studyInstanceUID)
    const seriesInstanceUID = readString(dataSet, TAGS.seriesInstanceUID)
    const rows = readNumber(dataSet, TAGS.rows)
    const columns = readNumber(dataSet, TAGS.columns)

    if (!studyInstanceUID || !seriesInstanceUID || !rows || !columns) {
      return {
        reason: missingMetadataReason({
          studyInstanceUID,
          seriesInstanceUID,
          rows,
          columns,
        }),
      }
    }

    return {
      instance: {
        file,
        imageId: addLocalDicomFile(file),
        patientName: readString(dataSet, TAGS.patientName),
        patientID: readString(dataSet, TAGS.patientID),
        patientBirthDate: readString(dataSet, TAGS.patientBirthDate),
        patientSex: readString(dataSet, TAGS.patientSex),
        studyInstanceUID,
        studyDate: readString(dataSet, TAGS.studyDate),
        studyDescription: readString(dataSet, TAGS.studyDescription),
        seriesInstanceUID,
        seriesNumber: readNumber(dataSet, TAGS.seriesNumber),
        seriesDescription: readString(dataSet, TAGS.seriesDescription),
        modality: readString(dataSet, TAGS.modality),
        instanceNumber: readNumber(dataSet, TAGS.instanceNumber),
        sopInstanceUID: readString(dataSet, TAGS.sopInstanceUID),
        frameOfReferenceUID: readString(dataSet, TAGS.frameOfReferenceUID),
        rows,
        columns,
        bitsAllocated: readNumber(dataSet, TAGS.bitsAllocated),
        bitsStored: readNumber(dataSet, TAGS.bitsStored),
        highBit: readNumber(dataSet, TAGS.highBit),
        pixelRepresentation: readNumber(dataSet, TAGS.pixelRepresentation),
        samplesPerPixel: readNumber(dataSet, TAGS.samplesPerPixel),
        photometricInterpretation: readString(dataSet, TAGS.photometricInterpretation),
        pixelSpacing: readNumberList(dataSet, TAGS.pixelSpacing),
        sliceThickness: readNumber(dataSet, TAGS.sliceThickness),
        sliceLocation: readNumber(dataSet, TAGS.sliceLocation),
        rescaleIntercept: readNumber(dataSet, TAGS.rescaleIntercept),
        rescaleSlope: readNumber(dataSet, TAGS.rescaleSlope),
        windowCenter: readNumber(dataSet, TAGS.windowCenter),
        windowWidth: readNumber(dataSet, TAGS.windowWidth),
        imagePositionPatient: readNumberList(dataSet, TAGS.imagePositionPatient),
        imageOrientationPatient: readNumberList(dataSet, TAGS.imageOrientationPatient),
      },
    }
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) }
  }
}

function parseMetadata(byteArray: Uint8Array) {
  const options = { untilTag: TAGS.pixelData }

  try {
    return dicomParser.parseDicom(byteArray, options)
  } catch (part10Error) {
    try {
      return dicomParser.parseDicom(byteArray, {
        ...options,
        TransferSyntaxUID: "1.2.840.10008.1.2.1",
      })
    } catch (rawError) {
      const first = part10Error instanceof Error ? part10Error.message : String(part10Error)
      const second = rawError instanceof Error ? rawError.message : String(rawError)
      throw new Error(`Part10: ${first}; Raw LE explicit: ${second}`)
    }
  }
}

function missingMetadataReason(values: {
  studyInstanceUID?: string
  seriesInstanceUID?: string
  rows?: number
  columns?: number
}) {
  const missing = []
  if (!values.studyInstanceUID) missing.push("StudyInstanceUID")
  if (!values.seriesInstanceUID) missing.push("SeriesInstanceUID")
  if (!values.rows) missing.push("Rows")
  if (!values.columns) missing.push("Columns")

  return `DICOM lido, mas faltam tags de imagem: ${missing.join(", ")}.`
}

function readString(dataSet: dicomParser.DataSet, tag: string) {
  const value = dataSet.string(tag)
  return value?.trim() || undefined
}

function readNumber(dataSet: dicomParser.DataSet, tag: string) {
  const value = readString(dataSet, tag)
  if (value) {
    const number = Number(value)
    if (Number.isFinite(number)) {
      return number
    }
  }

  const readers = [
    () => dataSet.uint16(tag),
    () => dataSet.int16(tag),
    () => dataSet.uint32(tag),
    () => dataSet.int32(tag),
  ]

  for (const reader of readers) {
    try {
      const number = reader()
      if (Number.isFinite(number)) {
        return number
      }
    } catch {
      // Try the next numeric representation.
    }
  }

  return undefined
}

function readNumberList(dataSet: dicomParser.DataSet, tag: string) {
  const value = readString(dataSet, tag)
  if (!value) {
    return undefined
  }

  const values = value.split("\\").map(Number).filter(Number.isFinite)
  return values.length ? values : undefined
}
