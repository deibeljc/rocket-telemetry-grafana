import React from 'react';
import { InlineField, MultiCombobox } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

const fieldOptions: Array<SelectableValue<string>> = [
  { label: 'Altitude', value: 'altitude' },
  { label: 'Latitude', value: 'latitude' },
  { label: 'Longitude', value: 'longitude' },
  { label: 'State', value: 'state' },
  { label: 'Pitch', value: 'pitch' },
  { label: 'Roll', value: 'roll' },
  { label: 'Yaw', value: 'yaw' },
  { label: 'G-Force', value: 'gforce' },
  { label: 'Signal', value: 'signal' },
];

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const { fields } = query;

  return (
    <>
      <InlineField label="Fields" labelWidth={16} tooltip="Select fields to stream">
        <MultiCombobox
          options={fieldOptions.map((field) => ({ label: field.label, value: field.value as string }))}
          value={fields?.map((field) => ({ label: field, value: field as string }))}
          onChange={(value) => onChange({ ...query, fields: value.map((v) => v.value as string) })}
          placeholder="Select fields (default: all)"
        />
      </InlineField>
    </>
  );
}
