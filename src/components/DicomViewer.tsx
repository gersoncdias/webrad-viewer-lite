import { useEffect, useRef, useState } from "react"
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

  useEffect(() => {
    loadBundledDicom()
  }, [])

  async function handleFiles(files: FileList | null) {
    await loadFiles(Array.from(files ?? []))
  }

  async function loadFiles(fileArray: File[]) {
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

  async function loadBundledDicom() {
    if (!isHttpProtocol()) {
      return
    }

    try {
      const files = await fetchDicomDirectory("../DICOM/")
      if (files.length) {
        await loadFiles(files)
      }
    } catch (error) {
      console.info("Carregamento automatico da pasta DICOM indisponivel", error)
    }
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
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner" />
              <strong>Carregando exame</strong>
              <span>
                {progress?.total
                  ? `${progress.analyzed} de ${progress.total} arquivos analisados`
                  : "Localizando imagens DICOM..."}
              </span>
            </div>
          </div>
        )}
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


function isHttpProtocol() {
  return window.location.protocol === "http:" || window.location.protocol === "https:"
}

async function fetchDicomDirectory(path: string): Promise<File[]> {
  const entries = await listDirectory(path)
  const files: File[] = []

  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(...await fetchDicomDirectory(entry.href))
      continue
    }

    const response = await fetch(entry.href)
    if (!response.ok) {
      continue
    }
    const blob = await response.blob()
    const fileName = decodeURIComponent(entry.href.split("/").filter(Boolean).at(-1) ?? "IM000000")
    files.push(new File([blob], fileName, { type: "application/dicom" }))
  }

  return files
}

async function listDirectory(path: string) {
  const response = await fetch(path)
  if (!response.ok) {
    return []
  }

  const html = await response.text()
  const document = new DOMParser().parseFromString(html, "text/html")
  const base = new URL(path, window.location.href)

  return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter((href) => href && href !== "../" && href !== "/")
    .map((href) => {
      const url = new URL(href, base)
      return {
        href: url.href,
        isDirectory: url.pathname.endsWith("/"),
      }
    })
    .filter((entry) => entry.href.startsWith(base.href))
}
