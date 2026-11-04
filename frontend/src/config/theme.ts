import {
  Button,
  Paper,
  Table,
  Anchor,
  TextInput,
  NativeSelect,
  Select,
  Textarea,
  createTheme,
} from '@mantine/core';

export const portalTheme = createTheme({
  primaryColor: 'portalGreen',
  primaryShade: 6,
  colors: {
    portalGreen: [
      '#f2faf5',
      '#eaf5ef',
      '#d4ebdd',
      '#b1d9c4',
      '#7cc0a0',
      '#46a47d',
      '#16805d',
      '#116c4e',
      '#0b503b',
      '#0b3d2e',
    ],
  },
  black: '#111827',
  defaultRadius: 'md',
  fontFamily: 'Noto Sans Thai, Tahoma, sans-serif',
  headings: {
    fontFamily: 'Noto Sans Thai, Tahoma, sans-serif',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '1.65' },
      h2: { fontSize: '21px', lineHeight: '1.65' },
      h3: { fontSize: '16.38px', lineHeight: '1.65' },
    },
  },
  components: {
    Anchor: Anchor.extend({ defaultProps: { underline: 'never' } }),
    Button: Button.extend({ defaultProps: { radius: 'md' } }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
    Table: Table.extend({ defaultProps: { highlightOnHover: false } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'sm' } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { size: 'sm' } }),
    Select: Select.extend({ defaultProps: { size: 'sm' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'sm' } }),
  },
});
