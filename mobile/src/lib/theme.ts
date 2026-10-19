export const lightColors = {
  navy: '#172554', blue: '#1E3A8A', orange: '#C65D12', green: '#16734B',
  red: '#B4233F', amber: '#985B0C', ink: '#0F172A', muted: '#64748B',
  line: '#E2E8F0', soft: '#F8FAFC', white: '#FFFFFF',
  blueSoft: '#EFF6FF', greenSoft: '#ECFDF5', amberSoft: '#FFFBEB', redSoft: '#FFF1F2',
  surface: '#FFFFFF', primary: '#1E3A8A', onPrimary: '#FFFFFF', danger: '#B4233F', success: '#16734B',
  pressed: '#F1F5F9', selected: '#E8EEFA', track: '#E8EDF4', overlay: 'rgba(15,23,42,.45)',
};

export type ThemeColors = typeof lightColors;
export const darkColors: ThemeColors = {
  navy: '#172554', blue: '#A4BDFF', orange: '#FDBA74', green: '#74D6AA',
  red: '#FFA3AF', amber: '#F4CC7B', ink: '#E8EEF8', muted: '#A6B5CB',
  line: '#2B3A50', soft: '#0B1220', white: '#FFFFFF',
  blueSoft: '#1B2C4B', greenSoft: '#102E28', amberSoft: '#342B1A', redSoft: '#362231',
  surface: '#141E30', primary: '#3157C8', onPrimary: '#FFFFFF', danger: '#B4233F', success: '#1D7454',
  pressed: '#1C2A40', selected: '#243757', track: '#2A374D', overlay: 'rgba(0,0,0,.65)',
};

export const shadow = {
  shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.035, shadowRadius: 8, elevation: 1,
};
