import type { DicomStudy } from "../dicom/types"

interface PatientInfoProps {
  study?: DicomStudy
}

export function PatientInfo({ study }: PatientInfoProps) {
  if (!study) {
    return <div className="patient-info muted">Nenhum exame carregado</div>
  }

  return (
    <div className="patient-info">
      <strong>{study.patient.patientName || "Paciente sem nome"}</strong>
    </div>
  )
}
