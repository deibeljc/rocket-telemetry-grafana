import { PanelPlugin } from '@grafana/data';
import { SimpleOptions } from './types';
import { SimplePanel } from './components/SimplePanel';

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addFieldNamePicker({
      path: 'latField',
      name: 'Latitude Field',
      description: 'Field to use for Latitude',
      defaultValue: 'latitude',
    })
    .addFieldNamePicker({
      path: 'longField',
      name: 'Longitude Field',
      description: 'Field to use for Longitude',
      defaultValue: 'longitude',
    })
    .addFieldNamePicker({
      path: 'altField',
      name: 'Altitude Field',
      description: 'Field to use for Altitude',
      defaultValue: 'altitude',
    });
});
