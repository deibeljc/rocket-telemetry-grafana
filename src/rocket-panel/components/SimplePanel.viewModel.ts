import { PanelProps } from '@grafana/data';
import { SimpleOptions } from '../types';
import { useMemo } from 'react';

export interface RocketPoint {
  lat: number;
  lng: number;
  alt: number;
}

export interface AltitudeRange {
  min: number;
  max: number;
}

export interface SimplePanelViewModel {
  path: [number, number, number][];
  lastPoint?: RocketPoint;
  hasData: boolean;
  altitudeRange: AltitudeRange;
}

const DEFAULT_RANGE: AltitudeRange = { min: 0, max: 1 };

export const useSimplePanelViewModel = (props: PanelProps<SimpleOptions>): SimplePanelViewModel => {
  const { data, options } = props;

  return useMemo(() => {
    if (data.series.length === 0) {
      return { path: [], hasData: false, altitudeRange: DEFAULT_RANGE };
    }

    const frame = data.series[0];

    const latField =
      frame.fields.find((f) => f.name === options.latField) ||
      frame.fields.find((f) => f.name.toLowerCase() === 'latitude');

    const longField =
      frame.fields.find((f) => f.name === options.longField) ||
      frame.fields.find((f) => f.name.toLowerCase() === 'longitude');

    const altField =
      frame.fields.find((f) => f.name === options.altField) ||
      frame.fields.find((f) => f.name.toLowerCase() === 'altitude');

    if (!latField || !longField || !altField) {
      return { path: [], hasData: false, altitudeRange: DEFAULT_RANGE };
    }

    const path: [number, number, number][] = [];
    const length = frame.length;
    let lastPoint: RocketPoint | undefined;
    let minAlt = Infinity;
    let maxAlt = -Infinity;

    for (let i = 0; i < length; i++) {
      const lat = latField.values[i];
      const lng = longField.values[i];
      const alt = altField.values[i];

      if (typeof lat === 'number' && typeof lng === 'number' && typeof alt === 'number') {
        path.push([lng, lat, alt]);
        lastPoint = { lat, lng, alt };
        minAlt = Math.min(minAlt, alt);
        maxAlt = Math.max(maxAlt, alt);
      }
    }

    return {
      path,
      lastPoint,
      hasData: path.length > 0,
      altitudeRange: path.length > 0 ? { min: minAlt, max: maxAlt } : DEFAULT_RANGE,
    };
  }, [data, options]);
};
