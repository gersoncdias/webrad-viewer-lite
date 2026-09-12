import { useRef, useState } from "react"
import { fullscreenViewport, resetViewport, DicomViewport } from "./DicomViewport"
import { PatientInfo } from "./PatientInfo"
import { SeriesList } from "./SeriesList"
import { Toolbar } from "./Toolbar"
import { parseDicomFiles } from "../dicom/parseDicomFiles"
import type { DicomLoadProgress, DicomSeries, DicomStudy, IgnoredDicomFile } from "../dicom/types"
import type { ActiveTool } from "../cornerstone/tools"

export function DicomViewer() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [studies, setStudies] = useState<DicomStudy[]>([])
  const [selectedSeries, setSelectedSeries] = useState<DicomSeries>()
  const [activeTool, setActiveTool] = useState<ActiveTool>("Scroll")
  const [progress, setProgress] = useState<DicomLoadProgress>()
  const [ignoredFiles, setIgnoredFiles] = useState<IgnoredDicomFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const selectedStudy = studies[0]

  async function handleFiles(files: FileList | null) {
    const fileArray = Array.from(files ?? [])
    if (!fileArray.length) {
      return
    }

    setIsLoading(true)
    setMessage("Lendo arquivos DICOM...")
    setStudies([])
    setSelectedSeries(undefined)
    setIgnoredFiles([])
    setActiveTool("Scroll")

    const result = await parseDicomFiles(fileArray, setProgress)
    setProgress(result.progress)
    setStudies(result.studies)
    setIgnoredFiles(result.ignoredFiles)

    const firstSeries = result.studies[0]?.series[0]
    setSelectedSeries(firstSeries)
    setMessage(
      result.progress.loaded
        ? ""
        : "Nenhuma imagem DICOM encontrada nesta pasta."
    )
    setIsLoading(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="app-title">
          <h1>Web-Rad Viewer</h1>
        </div>
        <PatientInfo study={selectedStudy} />
        <input
          multiple
          onChange={(event) => handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
          webkitdirectory=""
        />
        <button onClick={() => inputRef.current?.click()} type="button">
          Abrir Pasta
        </button>
      </header>

      {message && (
        <div className="statusbar">
          <span>{message}</span>
        </div>
      )}

      <section className="viewer-layout">
        <SeriesList
          onSelectSeries={setSelectedSeries}
          selectedSeriesUID={selectedSeries?.seriesInstanceUID}
          studies={studies}
        />
        <DicomViewport activeTool={activeTool} series={selectedSeries} study={selectedStudy} />
      </section>

      {!selectedSeries && ignoredFiles.length > 0 && (
        <section className="diagnostics">
          <strong>Diagnostico dos primeiros arquivos ignorados</strong>
          {ignoredFiles.slice(0, 8).map((file) => (
            <div key={file.name}>
              <span>{file.name}</span>
              <small>{file.reason}</small>
            </div>
          ))}
        </section>
      )}

      <Toolbar
        activeTool={activeTool}
        disabled={!selectedSeries}
        onFullscreen={fullscreenViewport}
        onReset={resetViewport}
        onToolChange={setActiveTool}
      />
    </main>
  )
}
