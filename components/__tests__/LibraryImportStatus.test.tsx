import React from 'react';
import { render } from '@testing-library/react-native';
import LibraryImportStatus from '../LibraryImportStatus';

test('renders provided status text', () => {
  const { getByText } = render(<LibraryImportStatus status="Metadaten werden gelesen…" />);

  expect(getByText('Metadaten werden gelesen…')).toBeTruthy();
});

test('renders fallback status when none is provided', () => {
  const { getByText } = render(<LibraryImportStatus status={null} />);

  expect(getByText('Import läuft…')).toBeTruthy();
});
