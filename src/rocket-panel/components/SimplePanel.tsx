import React from 'react';
import { PanelProps } from '@grafana/data';
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

const getStyles = (theme: any) => {
  return {
    wrapper: css`
      position: relative;
      width: 100%;
      height: 100%;
    `,
    infoOverlay: css`
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: ${theme.colors.background.primary};
      padding: 8px;
      border-radius: 4px;
      pointer-events: none;
      z-index: 10;
      border: 1px solid ${theme.colors.border.weak};
      font-size: 12px;
    `,
  };
};

export const SimplePanel: React.FC<Props> = (props) => {
  const { data, width, height, fieldConfig, id } = props;
  const styles = useStyles2(getStyles);
  const { points, lastPoint, hasData } = useSimplePanelViewModel(props);

  if (!hasData) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  const layers = [
    new PathLayer({
      id: 'path-layer',
      data: [{ path: points.map((p) => [p.lng, p.lat, p.alt]) }],
      pickable: true,
      widthScale: 20,
      widthMinPixels: 2,
      getPath: (d) => d.path,
      getColor: [255, 0, 0],
      getWidth: 2,
    }),
    lastPoint &&
      new ScatterplotLayer({
        id: 'scatter-layer',
        data: [lastPoint],
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        radiusScale: 6,
        radiusMinPixels: 1,
        radiusMaxPixels: 100,
        lineWidthMinPixels: 1,
        getPosition: (d) => [d.lng, d.lat, d.alt],
        getRadius: 5,
        getFillColor: [0, 112, 243],
        getLineColor: [255, 255, 255],
      }),
  ];

  const initialViewState = lastPoint
    ? {
        longitude: lastPoint.lng,
        latitude: lastPoint.lat,
        zoom: 14,
        pitch: 70,
        bearing: 0,
      }
    : {
        longitude: 0,
        latitude: 0,
        zoom: 1,
        pitch: 0,
        bearing: 0,
      };

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <DeckGL
        initialViewState={initialViewState}
        controller={true}
        layers={layers}
        style={{ width: '100%', height: '100%' }}
      >
        <Map mapLib={maplibregl} mapStyle="https://demotiles.maplibre.org/style.json" />
      </DeckGL>

      {lastPoint && (
        <div className={styles.infoOverlay}>
          <div>Lat: {lastPoint.lat.toFixed(4)}</div>
          <div>Lng: {lastPoint.lng.toFixed(4)}</div>
          <div>Alt: {lastPoint.alt.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};
