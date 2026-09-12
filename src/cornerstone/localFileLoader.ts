import { wadouri } from "@cornerstonejs/dicom-image-loader"

export function addLocalDicomFile(file: File): string {
  return wadouri.fileManager.add(file)
}

export function purgeLocalDicomFiles() {
  wadouri.fileManager.purge()
}
