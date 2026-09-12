import { App as DwvApp, AppOptions, ToolConfig, ViewConfig, WindowLevel } from "dwv"
import { useEffect, useRef, useState } from "react"
import type { ActiveTool } from "../cornerstone/tools"
import type { DicomSeries, DicomStudy } from "../dicom/types"

const LAYER_GROUP_ID = "dwv-layer-group"

interface DicomViewportProps {
  series?: DicomSeries
  study?: DicomStudy
  activeTool: ActiveTool
}

let currentApp: DwvApp | null = null
let currentZoom = 1

export function DicomViewport({ series, study, activeTool }: DicomViewportProps) {
  const appRef = useRef<DwvApp | null>(null)
  const activeToolRef = useRef(activeTool)
  const isReadyRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const scrollDragRef = useRef<ScrollDragState | null>(null)
  const windowLevelRef = useRef({ center: 40, width: 400 })
  const [imageIndex, setImageIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [windowLevelInfo, setWindowLevelInfo] = useState("")
  const totalImages = series?.instances.length ?? 0

  useEffect(() => {
    if (!series) {
      document.getElementById(LAYER_GROUP_ID)?.replaceChildren()
      return
    }

    const app = new DwvApp()
    const viewConfig = new ViewConfig(LAYER_GROUP_ID)
    const initialWindow = getInitialWindowLevel(series)
    windowLevelRef.current = initialWindow
    viewConfig.windowCenter = initialWindow.center
    viewConfig.windowWidth = initialWindow.width

    const options = new AppOptions({ "*": [viewConfig] })

    options.tools = {
      Scroll: new ToolConfig(),
      ZoomAndPan: new ToolConfig(),
      WindowLevel: new ToolConfig(),
    }
    options.viewOnFirstLoadItem = true

    setErrorMessage("")
    setImageIndex(0)
    isReadyRef.current = false
      setWindowLevelInfo(`WL ${Math.round(initialWindow.center)} / WW ${Math.round(initialWindow.width)}`)
    document.getElementById(LAYER_GROUP_ID)?.replaceChildren()
    resetViewerTransform()

    app.init(options)
    app.addEventListener("load", () => {
      setImageIndex(0)
      setWindowLevelInfo(`WL ${Math.round(initialWindow.center)} / WW ${Math.round(initialWindow.width)}`)
    })
    app.addEventListener("viewlayeradd", () => {
      isReadyRef.current = true
    })
    app.addEventListener("renderend", () => {
      isReadyRef.current = true
    })
    app.addEventListener("loaderror", (event: unknown) => {
      setErrorMessage(formatDwvEvent(event))
    })
    app.addEventListener("error", (event: unknown) => {
      setErrorMessage(formatDwvEvent(event))
    })
    app.addEventListener("positionchange", (event: unknown) => {
      setImageIndex(extractIndex(event))
    })

    appRef.current = app
    currentApp = app
    app.loadFiles(series.instances.map((instance) => instance.file))

    return () => {
      app.abortAllLoads()
      isReadyRef.current = false
      appRef.current = null
      if (currentApp === app) {
        currentApp = null
      }
      document.getElementById(LAYER_GROUP_ID)?.replaceChildren()
    }
  }, [series])

  useEffect(() => {
    const app = appRef.current
    activeToolRef.current = activeTool
    if (!app) {
      return
    }

    if (!isReadyRef.current) {
      return
    }
  }, [activeTool])

  useEffect(() => {
    const element = document.getElementById(LAYER_GROUP_ID)
    if (!element) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      const app = appRef.current
      if (!app || !isReadyRef.current) {
        return
      }

      event.preventDefault()

      if (activeToolRef.current === "Zoom") {
        const nextZoom = currentZoom * Math.exp(-event.deltaY * 0.0015)
        setViewerZoom(nextZoom)
        return
      }

      scrollDwv(app, event.deltaY > 0 ? 1 : -1, setImageIndex)
      applyViewerTransform()
    }

    const handlePointerDown = (event: PointerEvent) => {
      const app = appRef.current
      if (!app || !isReadyRef.current) {
        return
      }

      if (activeToolRef.current === "Scroll" && event.button === 0) {
        scrollDragRef.current = {
          pointerId: event.pointerId,
          y: event.clientY,
          index: getDwvSliceIndex(app),
        }
        element.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }

      if (event.button !== 0) {
        return
      }

      dragRef.current = {
        pointerId: event.pointerId,
        tool: activeToolRef.current,
        x: event.clientX,
        y: event.clientY,
        center: windowLevelRef.current.center,
        width: windowLevelRef.current.width,
        zoom: currentZoom,
      }
      element.setPointerCapture(event.pointerId)
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const app = appRef.current
      const drag = dragRef.current
      const scrollDrag = scrollDragRef.current
      if (!app) {
        return
      }

      if (scrollDrag && scrollDrag.pointerId === event.pointerId) {
        const deltaSlices = Math.trunc((event.clientY - scrollDrag.y) / 8)
        if (deltaSlices !== 0) {
          const nextIndex = clamp(scrollDrag.index + deltaSlices, 0, totalImages - 1)
          goToSlice(app, nextIndex)
          setImageIndex(nextIndex)
          applyViewerTransform()
        }
        event.preventDefault()
        return
      }

      if (!drag || drag.pointerId !== event.pointerId) {
        return
      }

      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y

      if (drag.tool === "Zoom") {
        const nextZoom = drag.zoom * Math.exp(-dy * 0.01)
        setViewerZoom(nextZoom)
      }

      if (drag.tool === "WindowLevel") {
        const next = {
          center: drag.center + dy,
          width: Math.max(1, drag.width + dx * 2),
        }
        windowLevelRef.current = next
        setDwvWindowLevel(app, next)
        setWindowLevelInfo(`WL ${Math.round(next.center)} / WW ${Math.round(next.width)}`)
      }

      if (drag.tool === "Pan") {
        app.translate(dx, dy)
        drag.x = event.clientX
        drag.y = event.clientY
      }

      event.preventDefault()
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId)
        }
      }

      if (scrollDragRef.current?.pointerId === event.pointerId) {
        scrollDragRef.current = null
        if (element.hasPointerCapture(event.pointerId)) {
          element.releasePointerCapture(event.pointerId)
        }
      }
    }

    const preventContextMenu = (event: MouseEvent) => event.preventDefault()

    element.addEventListener("wheel", handleWheel, { passive: false })
    element.addEventListener("pointerdown", handlePointerDown)
    element.addEventListener("pointermove", handlePointerMove)
    element.addEventListener("pointerup", handlePointerUp)
    element.addEventListener("pointercancel", handlePointerUp)
    element.addEventListener("contextmenu", preventContextMenu)

    return () => {
      element.removeEventListener("wheel", handleWheel)
      element.removeEventListener("pointerdown", handlePointerDown)
      element.removeEventListener("pointermove", handlePointerMove)
      element.removeEventListener("pointerup", handlePointerUp)
      element.removeEventListener("pointercancel", handlePointerUp)
      element.removeEventListener("contextmenu", preventContextMenu)
    }
  }, [totalImages])

  function handleSliderChange(value: string) {
    const app = appRef.current
    if (!app || !isReadyRef.current) {
      return
    }

    goToSlice(app, Number(value))
    setImageIndex(Number(value))
    applyViewerTransform()
  }

  return (
    <div className="viewport-shell">
      <div className="dwv-layer-group" id={LAYER_GROUP_ID} />
      {series && totalImages > 1 && (
        <input
          aria-label="Navegar imagens"
          className="slice-slider"
          max={totalImages - 1}
          min={0}
          onChange={(event) => handleSliderChange(event.target.value)}
          onInput={(event) => handleSliderChange(event.currentTarget.value)}
          type="range"
          value={imageIndex}
        />
      )}
      {series ? (
        <div className="image-counter">
          Imagem {Math.min(imageIndex + 1, totalImages)} / {totalImages}
        </div>
      ) : (
        <div className="viewport-empty">Nenhuma serie selecionada</div>
      )}
      {errorMessage && <div className="viewport-error">{errorMessage}</div>}
      {series && study && (
        <div className="study-overlay">
          <span>{study.studyDescription || "Estudo DICOM"}</span>
          <span>Data: {formatDicomDate(study.studyDate)}</span>
          <span>ID: {study.patient.patientID || "-"}</span>
          {windowLevelInfo && <span>{windowLevelInfo}</span>}
        </div>
      )}
    </div>
  )
}

export function resetViewport() {
  currentApp?.resetDisplay()
  resetViewerTransform()
}

export function fullscreenViewport() {
  const element = document.querySelector(".viewport-shell")
  if (element instanceof HTMLElement) {
    element.requestFullscreen()
  }
}

function getDwvTool(tool: ActiveTool) {
  if (tool === "WindowLevel") {
    return "WindowLevel"
  }

  if (tool === "Zoom" || tool === "Pan") {
    return "ZoomAndPan"
  }

  return "Scroll"
}

function setViewerZoom(value: number) {
  const nextZoom = clamp(value, 0.25, 8)
  currentZoom = nextZoom
  applyViewerTransform()
}

function applyViewerTransform() {
  const layerGroup = document.getElementById(LAYER_GROUP_ID)
  if (!layerGroup) {
    return
  }

  layerGroup.style.transform = `scale(${currentZoom})`
  layerGroup.style.transformOrigin = "center center"
}

function resetViewerTransform() {
  const layerGroup = document.getElementById(LAYER_GROUP_ID)
  if (!layerGroup) {
    return
  }

  currentZoom = 1
  layerGroup.style.transform = "scale(1)"
  layerGroup.style.transformOrigin = "center center"
}

function formatDwvEvent(event: unknown) {
  if (event instanceof Error) {
    return event.message
  }

  if (typeof event === "object" && event !== null) {
    const detail = "error" in event ? (event as { error?: unknown }).error : event
    if (detail instanceof Error) {
      return detail.message
    }

    return JSON.stringify(detail)
  }

  return String(event)
}

function extractIndex(event: unknown) {
  if (typeof event !== "object" || event === null) {
    return 0
  }

  const value = "k" in event ? (event as { k?: number }).k : undefined
  return typeof value === "number" ? value : 0
}

function getInitialWindowLevel(series: DicomSeries) {
  const instance = series.instances.find(
    (item) => typeof item.windowCenter === "number" && typeof item.windowWidth === "number"
  )

  return {
    center: instance?.windowCenter ?? 40,
    width: instance?.windowWidth ?? 400,
  }
}

function formatDicomDate(value?: string) {
  if (!value || value.length !== 8) {
    return value || "-"
  }

  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`
}

interface DragState {
  pointerId: number
  tool: ActiveTool
  x: number
  y: number
  center: number
  width: number
  zoom: number
}

interface ScrollDragState {
  pointerId: number
  y: number
  index: number
}

function scrollDwv(app: DwvApp, direction: 1 | -1, onIndexChange?: (index: number) => void) {
  try {
    const helper = app.getActiveLayerGroup()?.getPositionHelper()
    if (!helper) {
      return
    }

    const didScroll =
      direction > 0
        ? helper.incrementPositionAlongScroll()
        : helper.decrementPositionAlongScroll()

    if (didScroll) {
      const layer = app.getActiveLayerGroup()?.getActiveViewLayer()
      layer?.getViewController().setCurrentPosition(helper.getCurrentPosition())
      app.getActiveLayerGroup()?.draw()
      onIndexChange?.(helper.getCurrentPositionScrollValue())
    }
  } catch (error) {
    console.warn("DWV scroll manual falhou", error)
  }
}

function goToSlice(app: DwvApp, index: number) {
  try {
    const helper = app.getActiveLayerGroup()?.getPositionHelper()
    const layer = app.getActiveLayerGroup()?.getActiveViewLayer()
    const viewController = layer?.getViewController()
    if (!helper || !viewController) {
      return
    }

    const position = helper.getCurrentPositionAtScrollValue(index)
    helper.setCurrentPositionSafe(position)
    viewController.setCurrentPosition(position)
    app.getActiveLayerGroup()?.draw()
  } catch (error) {
    console.warn("DWV goToSlice falhou", error)
  }
}

function getDwvSliceIndex(app: DwvApp) {
  try {
    return app.getActiveLayerGroup()?.getPositionHelper()?.getCurrentPositionScrollValue() ?? 0
  } catch {
    return 0
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function setDwvWindowLevel(app: DwvApp, windowLevel: { center: number; width: number }) {
  const layer = app.getActiveLayerGroup()?.getActiveViewLayer()
  const viewController = layer?.getViewController()
  viewController?.setWindowLevel(new WindowLevel(windowLevel.center, windowLevel.width))
  app.getActiveLayerGroup()?.draw()
}
