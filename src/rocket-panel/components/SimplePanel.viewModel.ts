import { PanelProps } from '@grafana/data';
import { SimpleOptions } from '../types';
import { useMemo } from 'react';

export interface RocketPoint {
  lat: number;
  lng: number;
  alt: number;
}

export interface SimplePanelViewModel {
  points: RocketPoint[];
  lastPoint?: RocketPoint;
  hasData: boolean;
}

export const useSimplePanelViewModel = (props: PanelProps<SimpleOptions>): SimplePanelViewModel => {
  const { data, options } = props;

  return useMemo(() => {
    if (data.series.length === 0) {
      return { points: [], hasData: false };
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
      return { points: [], hasData: false };
    }

    const points: RocketPoint[] = [];
    const length = frame.length;

    for (let i = 0; i < length; i++) {
      const lat = latField.values[i];
      const lng = longField.values[i];
      const alt = altField.values[i];

      if (typeof lat === 'number' && typeof lng === 'number' && typeof alt === 'number') {
        points.push({ lat, lng, alt });
      }
    }

    return {
      points,
      lastPoint: points.length > 0 ? points[points.length - 1] : undefined,
      hasData: points.length > 0,
    };
  }, [data, options]);
};
