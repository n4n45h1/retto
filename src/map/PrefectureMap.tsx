import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import mapData from "../data/maps/prefectures.json";
import "./PrefectureMap.css";

export type PrefectureId = `jp-${string}`;

export interface Prefecture {
  id: PrefectureId;
  code: string;
  name: string;
}

export interface PrefectureMapContext<TMetric, TDetails> {
  prefecture: Prefecture;
  metric: TMetric | undefined;
  details: TDetails | undefined;
  selected: boolean;
  hovered: boolean;
}

export interface PrefectureMapProps<TMetric = unknown, TDetails = unknown> {
  selectedId: PrefectureId | null;
  onSelect: (id: PrefectureId) => void;
  metrics?: Partial<Record<PrefectureId, TMetric>>;
  details?: Partial<Record<PrefectureId, TDetails>>;
  getFill?: (
    context: PrefectureMapContext<TMetric, TDetails>,
  ) => string | undefined;
  renderDetails?: (
    context: PrefectureMapContext<TMetric, TDetails>,
  ) => ReactNode;
  renderLabel?: (context: PrefectureMapContext<TMetric, TDetails>) => string;
  showLabels?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface BaseView {
  width: number;
  height: number;
}

interface MapAnchor {
  id: PrefectureId;
  x: number;
  y: number;
}

interface CameraGesture {
  centerX: number;
  centerY: number;
  distance: number;
  moved: boolean;
}

const squareBaseView: BaseView = {
  width: mapData.width,
  height: mapData.height,
};
const majorPrefectureCodes = new Set([
  "01",
  "04",
  "13",
  "14",
  "23",
  "27",
  "28",
  "34",
  "40",
  "47",
]);

function quantizePath(path: string, grid = 2.5): string {
  return path.replace(/-?\d+(?:\.\d+)?/g, (value) =>
    (Math.round(Number(value) / grid) * grid).toFixed(1),
  );
}

const mapFeatures = mapData.features.map((feature) => ({
  ...feature,
  path: quantizePath(feature.path),
}));

function getResetCamera(baseView: BaseView): Camera {
  return {
    x: (mapData.width - baseView.width) / 2,
    y: (mapData.height - baseView.height) / 2,
    zoom: 1,
  };
}

function getBaseView(width: number, height: number): BaseView {
  const aspect = width / Math.max(height, 1);
  return aspect >= 1
    ? { width: mapData.width * aspect, height: mapData.height }
    : { width: mapData.width, height: mapData.height / aspect };
}

function clampCamera(camera: Camera, baseView: BaseView): Camera {
  const viewWidth = baseView.width / camera.zoom;
  const viewHeight = baseView.height / camera.zoom;
  const marginX = Math.max(
    mapData.width * 0.2,
    (baseView.width - mapData.width) / 2,
  );
  const marginY = Math.max(
    mapData.height * 0.2,
    (baseView.height - mapData.height) / 2,
  );
  const minX = -marginX;
  const maxX = mapData.width - viewWidth + marginX;
  const minY = -marginY;
  const maxY = mapData.height - viewHeight + marginY;
  return {
    ...camera,
    x:
      minX > maxX
        ? (mapData.width - viewWidth) / 2
        : Math.min(maxX, Math.max(minX, camera.x)),
    y:
      minY > maxY
        ? (mapData.height - viewHeight) / 2
        : Math.min(maxY, Math.max(minY, camera.y)),
  };
}

export function isSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

export function PrefectureMap<TMetric = unknown, TDetails = unknown>({
  selectedId,
  onSelect,
  metrics,
  details,
  getFill,
  renderDetails,
  renderLabel,
  showLabels = false,
  className,
  ariaLabel = "日本の都道府県地図",
}: PrefectureMapProps<TMetric, TDetails>) {
  const [hoveredId, setHoveredId] = useState<PrefectureId | null>(null);
  const [baseView, setBaseView] = useState(squareBaseView);
  const [camera, setCamera] = useState(() => getResetCamera(squareBaseView));
  const baseViewRef = useRef(squareBaseView);
  const [anchors, setAnchors] = useState<MapAnchor[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<CameraGesture | null>(null);
  const suppressClickRef = useRef(false);
  const descriptionId = useId();
  const activeId = hoveredId ?? selectedId;
  const activeFeature = mapFeatures.find(({ id }) => id === activeId);
  const rootClassName = ["prefecture-map", className].filter(Boolean).join(" ");
  const viewWidth = baseView.width / camera.zoom;
  const viewHeight = baseView.height / camera.zoom;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextBaseView = getBaseView(
        entry.contentRect.width,
        entry.contentRect.height,
      );
      const currentBaseView = baseViewRef.current;
      if (
        Math.abs(currentBaseView.width - nextBaseView.width) < 0.1 &&
        Math.abs(currentBaseView.height - nextBaseView.height) < 0.1
      ) {
        return;
      }
      baseViewRef.current = nextBaseView;
      setBaseView(nextBaseView);
      setCamera((current) => {
        const oldViewWidth = currentBaseView.width / current.zoom;
        const oldViewHeight = currentBaseView.height / current.zoom;
        const nextViewWidth = nextBaseView.width / current.zoom;
        const nextViewHeight = nextBaseView.height / current.zoom;
        return clampCamera(
          {
            ...current,
            x: current.x + (oldViewWidth - nextViewWidth) / 2,
            y: current.y + (oldViewHeight - nextViewHeight) / 2,
          },
          nextBaseView,
        );
      });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!showLabels || !svgRef.current) return;
    setAnchors(
      mapFeatures.map((feature) => {
        const path = svgRef.current?.querySelector<SVGGraphicsElement>(
          `#${feature.id}`,
        );
        const bounds = path?.getBBox();
        return {
          id: feature.id as PrefectureId,
          x: (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
          y: (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
        };
      }),
    );
  }, [showLabels]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      const ratioX = (event.clientX - bounds.left) / bounds.width;
      const ratioY = (event.clientY - bounds.top) / bounds.height;
      setCamera((current) => {
        const zoom = Math.min(
          6,
          Math.max(1, current.zoom * Math.exp(-event.deltaY * 0.001)),
        );
        const focusX = current.x + ratioX * (baseView.width / current.zoom);
        const focusY = current.y + ratioY * (baseView.height / current.zoom);
        return clampCamera(
          {
            zoom,
            x: focusX - ratioX * (baseView.width / zoom),
            y: focusY - ratioY * (baseView.height / zoom),
          },
          baseView,
        );
      });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [baseView]);

  function setZoom(nextZoom: number, clientX?: number, clientY?: number) {
    const zoom = Math.min(6, Math.max(1, nextZoom));
    const bounds = svgRef.current?.getBoundingClientRect();
    const ratioX =
      bounds && clientX !== undefined
        ? (clientX - bounds.left) / bounds.width
        : 0.5;
    const ratioY =
      bounds && clientY !== undefined
        ? (clientY - bounds.top) / bounds.height
        : 0.5;
    setCamera((current) => {
      const focusX = current.x + ratioX * (baseView.width / current.zoom);
      const focusY = current.y + ratioY * (baseView.height / current.zoom);
      return clampCamera(
        {
          zoom,
          x: focusX - ratioX * (baseView.width / zoom),
          y: focusY - ratioY * (baseView.height / zoom),
        },
        baseView,
      );
    });
  }

  function moveCamera(
    gesture: CameraGesture,
    centerX: number,
    centerY: number,
    distance: number,
    bounds: DOMRect,
    canZoom: boolean,
  ) {
    const previousCenterX = gesture.centerX;
    const previousCenterY = gesture.centerY;
    const previousDistance = gesture.distance;
    if (
      Math.abs(centerX - previousCenterX) +
        Math.abs(centerY - previousCenterY) >
        2 ||
      Math.abs(distance - previousDistance) > 2
    ) {
      gesture.moved = true;
    }
    setCamera((current) => {
      const oldRatioX = (previousCenterX - bounds.left) / bounds.width;
      const oldRatioY = (previousCenterY - bounds.top) / bounds.height;
      const newRatioX = (centerX - bounds.left) / bounds.width;
      const newRatioY = (centerY - bounds.top) / bounds.height;
      const focusX = current.x + oldRatioX * (baseView.width / current.zoom);
      const focusY = current.y + oldRatioY * (baseView.height / current.zoom);
      const zoom =
        canZoom && previousDistance > 0
          ? Math.min(
              6,
              Math.max(1, current.zoom * (distance / previousDistance)),
            )
          : current.zoom;
      return clampCamera(
        {
          zoom,
          x: focusX - newRatioX * (baseView.width / zoom),
          y: focusY - newRatioY * (baseView.height / zoom),
        },
        baseView,
      );
    });
    gesture.centerX = centerX;
    gesture.centerY = centerY;
    gesture.distance = distance;
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointersRef.current.values()];
    const first = points[0];
    if (!first) return;
    const second = points[1];
    gestureRef.current = {
      centerX: second ? (first.x + second.x) / 2 : first.x,
      centerY: second ? (first.y + second.y) / 2 : first.y,
      distance: second ? Math.hypot(second.x - first.x, second.y - first.y) : 0,
      moved: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const gesture = gestureRef.current;
    const bounds = svgRef.current?.getBoundingClientRect();
    const points = [...pointersRef.current.values()];
    const first = points[0];
    if (!gesture || !bounds || !first) return;
    const second = points[1];
    const centerX = second ? (first.x + second.x) / 2 : first.x;
    const centerY = second ? (first.y + second.y) / 2 : first.y;
    const distance = second
      ? Math.hypot(second.x - first.x, second.y - first.y)
      : 0;
    moveCamera(gesture, centerX, centerY, distance, bounds, Boolean(second));
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    suppressClickRef.current = gesture?.moved ?? false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const remaining = [...pointersRef.current.values()][0];
    gestureRef.current = remaining
      ? {
          centerX: remaining.x,
          centerY: remaining.y,
          distance: 0,
          moved: gesture?.moved ?? false,
        }
      : null;
    requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }

  function contextFor(feature: (typeof mapFeatures)[number]) {
    const prefecture = feature as Prefecture;
    return {
      prefecture,
      metric: metrics?.[prefecture.id],
      details: details?.[prefecture.id],
      selected: prefecture.id === selectedId,
      hovered: prefecture.id === hoveredId,
    } satisfies PrefectureMapContext<TMetric, TDetails>;
  }

  return (
    <div className={rootClassName}>
      <svg
        ref={svgRef}
        className="prefecture-map__svg"
        viewBox={`${camera.x} ${camera.y} ${viewWidth} ${viewHeight}`}
        aria-label={ariaLabel}
        aria-describedby={
          renderDetails && activeFeature ? descriptionId : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <pattern
            id={`${descriptionId}-terrain`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="4" fill="#ffffff" opacity="0.09" />
            <rect
              x="7"
              y="7"
              width="3"
              height="3"
              fill="#173e2d"
              opacity="0.12"
            />
          </pattern>
          <pattern
            id={`${descriptionId}-water`}
            width="48"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <rect width="48" height="32" fill="#327ad2" />
            <path
              d="M4 12h12v3H4zm24 12h10v3H28z"
              fill="#8fc1f3"
              opacity="0.18"
            />
          </pattern>
        </defs>
        <rect
          className="prefecture-map__water"
          x={camera.x}
          y={camera.y}
          width={viewWidth}
          height={viewHeight}
          fill={`url(#${descriptionId}-water)`}
        />
        {mapFeatures.map((feature) => {
          const context = contextFor(feature);
          const fill = getFill?.(context);
          const style = fill
            ? ({ "--prefecture-fill": fill } as CSSProperties)
            : undefined;
          return (
            // biome-ignore lint/a11y/useSemanticElements: An SVG path is the semantic geographic hit target.
            <path
              key={feature.id}
              id={feature.id}
              className="prefecture-map__prefecture"
              d={feature.path}
              fillRule="evenodd"
              role="button"
              tabIndex={0}
              aria-label={feature.name}
              aria-pressed={context.selected}
              data-prefecture-code={feature.code}
              data-hovered={context.hovered || undefined}
              style={style}
              onMouseEnter={() => setHoveredId(feature.id as PrefectureId)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(feature.id as PrefectureId)}
              onBlur={() => setHoveredId(null)}
              onClick={() => {
                if (!suppressClickRef.current) {
                  onSelect(feature.id as PrefectureId);
                }
              }}
              onKeyDown={(event) => {
                if (isSelectionKey(event.key)) {
                  event.preventDefault();
                  onSelect(feature.id as PrefectureId);
                }
              }}
            >
              <title>{feature.name}</title>
            </path>
          );
        })}
        <g className="prefecture-map__terrain">
          {mapFeatures.map((feature) => (
            <path
              key={feature.id}
              d={feature.path}
              fillRule="evenodd"
              fill={`url(#${descriptionId}-terrain)`}
            />
          ))}
        </g>
        {showLabels ? (
          <g className="prefecture-map__labels">
            {anchors.map((anchor) => {
              const feature = mapFeatures.find(({ id }) => id === anchor.id);
              if (!feature) return null;
              const context = contextFor(feature);
              const code = Number(feature.code);
              const visible =
                context.selected ||
                context.hovered ||
                camera.zoom >= 3 ||
                (camera.zoom >= 1.8 && code % 2 === 0) ||
                majorPrefectureCodes.has(feature.code);
              if (!visible) return null;
              const text = renderLabel?.(context) ?? feature.name;
              const width = Math.max(48, text.length * 9 + 16);
              const markerType = code % 3;
              return (
                <g
                  key={anchor.id}
                  className="prefecture-map__label"
                  transform={`translate(${anchor.x} ${anchor.y})`}
                >
                  <g transform={`scale(${1 / camera.zoom})`}>
                    <g
                      className={`prefecture-map__command sprite-${markerType}`}
                    >
                      {markerType === 0 ? (
                        <>
                          <rect
                            className="command-base"
                            x="-10"
                            y="-17"
                            width="20"
                            height="9"
                          />
                          <rect x="-7" y="-24" width="14" height="7" />
                          <rect x="-4" y="-29" width="8" height="5" />
                        </>
                      ) : markerType === 1 ? (
                        <>
                          <rect
                            className="command-pole"
                            x="-1"
                            y="-30"
                            width="3"
                            height="22"
                          />
                          <path
                            className="command-flag"
                            d="M2-29H14L10-23 14-17H2Z"
                          />
                        </>
                      ) : (
                        <>
                          <path
                            className="command-roof"
                            d="M-11-22H-7V-28H-2V-22H3V-28H8V-22H11V-8H-11Z"
                          />
                          <rect
                            className="command-door"
                            x="-3"
                            y="-16"
                            width="6"
                            height="8"
                          />
                        </>
                      )}
                    </g>
                    <circle className="prefecture-map__capital" cy="-8" r="5" />
                    <rect
                      x={-width / 2}
                      y="0"
                      width={width}
                      height="18"
                      rx="2"
                    />
                    <text y="12" textAnchor="middle">
                      {text}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>
      <fieldset className="prefecture-map__camera-controls">
        <legend className="visually-hidden">地図操作</legend>
        <button
          type="button"
          aria-label="地図を拡大"
          onClick={() => setZoom(camera.zoom + 0.5)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="地図を縮小"
          onClick={() => setZoom(camera.zoom - 0.5)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="地図表示をリセット"
          onClick={() => setCamera(getResetCamera(baseView))}
        >
          ◎
        </button>
      </fieldset>
      <span className="prefecture-map__zoom" aria-hidden="true">
        {Math.round(camera.zoom * 100)}%
      </span>
      {renderDetails && activeFeature ? (
        <div
          id={descriptionId}
          className="prefecture-map__details"
          aria-live="polite"
        >
          {renderDetails(contextFor(activeFeature))}
        </div>
      ) : null}
    </div>
  );
}
