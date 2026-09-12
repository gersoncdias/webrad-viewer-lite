export interface DicomPatient {
  patientName?: string
  patientID?: string
  patientBirthDate?: string
  patientSex?: string
}

export interface DicomInstance {
  file: File
  imageId: string
  sopInstanceUID?: string
  instanceNumber?: number
  rows?: number
  columns?: number
  bitsAllocated?: number
  bitsStored?: number
  highBit?: number
  samplesPerPixel?: number
  pixelRepresentation?: number
  photometricInterpretation?: string
  pixelSpacing?: number[]
  frameOfReferenceUID?: string
  sliceThickness?: number
  sliceLocation?: number
  rescaleIntercept?: number
  rescaleSlope?: number
  windowCenter?: number
  windowWidth?: number
  imagePositionPatient?: number[]
  imageOrientationPatient?: number[]
}

export interface DicomSeries {
  seriesInstanceUID: string
  seriesNumber?: number
  seriesDescription?: string
  modality?: string
  instances: DicomInstance[]
}

export interface DicomStudy {
  studyInstanceUID: string
  studyDate?: string
  studyDescription?: string
  patient: DicomPatient
  series: DicomSeries[]
}

export interface DicomLoadProgress {
  analyzed: number
  total: number
  loaded: number
  ignored: number
}

export interface IgnoredDicomFile {
  name: string
  reason: string
}

export interface DicomLoadResult {
  studies: DicomStudy[]
  progress: DicomLoadProgress
  ignoredFiles: IgnoredDicomFile[]
}
