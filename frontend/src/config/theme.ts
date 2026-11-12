import {
  Button,
  Paper,
  Table,
  Anchor,
  TextInput,
  NativeSelect,
  Select,
  Textarea,
  Modal,
  createTheme,
} from '@mantine/core';
import buttonStyles from './portal-button.module.css';

export const portalTheme = createTheme({
  breakpoints: { sidebar: '64em', compact: '37.5em' },
  primaryColor: 'portalGreen',
  primaryShade: 6,
  colors: {
    portalGreen: [
      '#fff8df',
      '#fff3bd',
      '#ffe88a',
      '#ffdc57',
      '#ffd233',
      '#ffca1a',
      '#ffc400',
      '#886800',
      '#6b5200',
      '#302600',
    ],
  },
  autoContrast: true,
  black: '#292929',
  defaultRadius: 'md',
  radius: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '20px' },
  fontFamily: '"LINE Seed Sans TH", Tahoma, sans-serif',
  fontFamilyMonospace: '"LINE Seed Sans TH", Tahoma, sans-serif',
  headings: {
    fontFamily: '"LINE Seed Sans TH", Tahoma, sans-serif',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '1.65' },
      h2: { fontSize: '21px', lineHeight: '1.65' },
      h3: { fontSize: '16.38px', lineHeight: '1.65' },
    },
  },
  components: {
    Anchor: Anchor.extend({ defaultProps: { underline: 'never' } }),
    Button: Button.extend({
      defaultProps: { radius: 'md' },
      classNames: (theme, props) => {
        const variant = props.variant || 'filled';
        const primary = !props.color || props.color === theme.primaryColor;
        return {
          root: [
            buttonStyles.root,
            primary && variant === 'filled' ? buttonStyles.primary : '',
            variant === 'default' ? buttonStyles.secondary : '',
            primary && variant === 'outline' ? buttonStyles.outline : '',
          ]
            .filter(Boolean)
            .join(' '),
        };
      },
    }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
    Modal: Modal.extend({ defaultProps: { radius: 'xl' } }),
    Table: Table.extend({ defaultProps: { highlightOnHover: false } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'sm' } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { size: 'sm' } }),
    Select: Select.extend({ defaultProps: { size: 'sm' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'sm' } }),
  },
});
