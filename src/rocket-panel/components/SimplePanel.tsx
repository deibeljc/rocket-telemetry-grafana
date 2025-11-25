import React, { useState, useMemo, useCallback, memo } from 'react';
import { PanelProps, GrafanaTheme2 } from '@grafana/data';
import { SimpleOptions } from '../types';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from 'deck.gl';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useSimplePanelViewModel } from './SimplePanel.viewModel';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: '4px',
  }),
  telemetryCard: css({
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    background: 'rgba(12, 12, 14, 0.85)',
    backdropFilter: 'blur(12px)',
    padding: '14px 18px',
    borderRadius: '8px',
    pointerEvents: 'none',
    zIndex: 10,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
    minWidth: '140px',
  }),
  cardHeader: css({
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    '&::before': {
      content: '""',
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: '#22c55e',
      boxShadow: '0 0 8px #22c55e',
      animation: 'pulse 2s infinite',
    },
  }),
  dataRow: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    '&:last-child': {
      borderBottom: 'none',
    },
  }),
  label: css({
    fontSize: '10px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }),
  value: css({
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    fontFeatureSettings: '"tnum"',
  }),
  altValue: css({
    color: '#f97316',
  }),
  unit: css({
    fontSize: '9px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.35)',
    marginLeft: '3px',
  }),
});

// Altitude-based color interpolation for the arc
const getAltitudeColor = (altitude: number, minAlt: number, maxAlt: number): [number, number, number, number] => {
  const range = maxAlt - minAlt || 1;
  const t = Math.max(0, Math.min(1, (altitude - minAlt) / range));

  // Gradient: teal (low) -> orange (mid) -> magenta (high)
  if (t < 0.5) {
    const s = t * 2;
    return [
      Math.round(20 + s * 229), // 20 -> 249
      Math.round(184 - s * 69), // 184 -> 115
      Math.round(166 - s * 144), // 166 -> 22
      255,
    ];
  } else {
    const s = (t - 0.5) * 2;
    return [
      Math.round(249 - s * 32), // 249 -> 217
      Math.round(115 - s * 45), // 115 -> 70
      Math.round(22 + s * 217), // 22 -> 239
      255,
    ];
  }
};

const InfoOverlay = memo(
  ({ lat, lng, alt, styles }: { lat: number; lng: number; alt: number; styles: ReturnType<typeof getStyles> }) => (
    <div className={styles.telemetryCard}>
      <div className={styles.cardHeader}>Live Position</div>
      <div className={styles.dataRow}>
        <span className={styles.label}>Lat</span>
        <span className={styles.value}>{lat.toFixed(5)}°</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.label}>Lng</span>
        <span className={styles.value}>{lng.toFixed(5)}°</span>
      </div>
      <div className={styles.dataRow}>
        <span className={styles.label}>Alt</span>
        <span className={`${styles.value} ${styles.altValue}`}>
          {alt.toFixed(1)}
          <span className={styles.unit}>m</span>
        </span>
      </div>
    </div>
  )
);
InfoOverlay.displayName = 'InfoOverlay';

export const SimplePanel: React.FC<Props> = (props) => {
  const { data, width, height, fieldConfig, id } = props;
  const styles = useStyles2(getStyles);
  const { path, lastPoint, hasData, altitudeRange } = useSimplePanelViewModel(props);

  const [manualViewState, setManualViewState] = useState<{
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  } | null>(null);
  const [isManuallyControlling, setIsManuallyControlling] = useState(false);

  const autoViewState = useMemo(() => {
    if (lastPoint) {
      return {
        longitude: lastPoint.lng,
        latitude: lastPoint.lat,
        zoom: 14,
        pitch: 55,
        bearing: -15,
      };
    }
    return { longitude: 0, latitude: 0, zoom: 1, pitch: 0, bearing: 0 };
  }, [lastPoint]);

  const viewState = isManuallyControlling && manualViewState ? manualViewState : autoViewState;

  const onViewStateChange = useCallback(({ viewState: newViewState, interactionState }: any) => {
    setManualViewState(newViewState);
    if (interactionState?.isDragging || interactionState?.isZooming || interactionState?.isRotating) {
      setIsManuallyControlling(true);
    }
  }, []);

  const layers = useMemo(() => {
    if (path.length === 0) return [];

    const { min, max } = altitudeRange;

    // Create path segments with altitude-based colors
    type PathPoint = [number, number, number];
    const segments = path.slice(0, -1).map((point: PathPoint, i: number) => ({
      path: [point, path[i + 1]] as [PathPoint, PathPoint],
      color: getAltitudeColor((point[2] + path[i + 1][2]) / 2, min, max),
    }));

    return [
      // Main trajectory arc with gradient
      new PathLayer({
        id: 'trajectory-arc',
        data: segments,
        pickable: false,
        widthScale: 1,
        widthMinPixels: 3,
        widthMaxPixels: 8,
        capRounded: true,
        jointRounded: true,
        getPath: (d: { path: [number, number, number][] }) => d.path,
        getColor: (d: { color: [number, number, number, number] }) => d.color,
        getWidth: 4,
        billboard: true,
        updateTriggers: {
          getColor: [min, max],
        },
      }),
      // Glow layer for depth
      new PathLayer({
        id: 'trajectory-glow',
        data: segments,
        pickable: false,
        widthScale: 1,
        widthMinPixels: 8,
        widthMaxPixels: 20,
        capRounded: true,
        jointRounded: true,
        getPath: (d: { path: [number, number, number][] }) => d.path,
        getColor: (d: { color: [number, number, number, number] }) => [d.color[0], d.color[1], d.color[2], 60],
        getWidth: 12,
        billboard: true,
        updateTriggers: {
          getColor: [min, max],
        },
      }),
      // Current position marker
      lastPoint &&
        new ScatterplotLayer({
          id: 'position-marker',
          data: [lastPoint],
          pickable: false,
          stroked: true,
          filled: true,
          radiusMinPixels: 8,
          radiusMaxPixels: 12,
          lineWidthMinPixels: 2,
          getPosition: (d: { lng: number; lat: number; alt: number }) => [d.lng, d.lat, d.alt],
          getRadius: 8,
          getFillColor: [255, 255, 255, 255],
          getLineColor: [249, 115, 22, 255],
          getLineWidth: 3,
        }),
      // Outer pulse ring
      lastPoint &&
        new ScatterplotLayer({
          id: 'position-pulse',
          data: [lastPoint],
          pickable: false,
          stroked: true,
          filled: false,
          radiusMinPixels: 16,
          radiusMaxPixels: 24,
          lineWidthMinPixels: 1,
          getPosition: (d: { lng: number; lat: number; alt: number }) => [d.lng, d.lat, d.alt],
          getRadius: 16,
          getLineColor: [249, 115, 22, 100],
          getLineWidth: 1,
        }),
    ].filter(Boolean);
  }, [path, lastPoint, altitudeRange]);

  if (!hasData) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapLib={maplibregl}
          mapStyle={{
            version: 8,
            sources: {
              satellite: {
                type: 'raster',
                tiles: [
                  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                ],
                tileSize: 256,
                maxzoom: 19,
              },
              labels: {
                type: 'raster',
                tiles: [
                  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                ],
                tileSize: 256,
                maxzoom: 19,
              },
              roads: {
                type: 'raster',
                tiles: [
                  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
                ],
                tileSize: 256,
                maxzoom: 19,
              },
            },
            layers: [
              {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
              },
              {
                id: 'roads-layer',
                type: 'raster',
                source: 'roads',
              },
              {
                id: 'labels-layer',
                type: 'raster',
                source: 'labels',
              },
            ],
          }}
        />
      </DeckGL>

      {lastPoint && <InfoOverlay lat={lastPoint.lat} lng={lastPoint.lng} alt={lastPoint.alt} styles={styles} />}
    </div>
  );
};
