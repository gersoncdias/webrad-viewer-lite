import type { DicomSeries, DicomStudy } from "../dicom/types"

interface SeriesListProps {
  studies: DicomStudy[]
  selectedSeriesUID?: string
  onSelectSeries: (series: DicomSeries) => void
}

export function SeriesList({ studies, selectedSeriesUID, onSelectSeries }: SeriesListProps) {
  return (
    <aside className="series-panel">
      <h2>Series</h2>
      {studies.length === 0 ? (
        <p className="muted">Selecione uma pasta DICOM.</p>
      ) : (
        studies.map((study) => (
          <div className="study-group" key={study.studyInstanceUID}>
            {study.series.map((series) => (
              <button
                className={series.seriesInstanceUID === selectedSeriesUID ? "series-item active" : "series-item"}
                key={series.seriesInstanceUID}
                onClick={() => onSelectSeries(series)}
                type="button"
              >
                <span className="series-modality">{series.modality || "DICOM"}</span>
                <strong>Serie {series.seriesNumber ?? "-"}</strong>
                <span>{series.seriesDescription || "Sem descricao"}</span>
                <span>{series.instances.length} imagens</span>
              </button>
            ))}
          </div>
        ))
      )}
    </aside>
  )
}
