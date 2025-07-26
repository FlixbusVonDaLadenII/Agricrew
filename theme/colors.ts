export type Theme = 'light' | 'dark';

interface ColorPalette {
    background: string;
    surface: string;
    surfaceHighlight: string;
    text: string;
    textSecondary: string;
    textHint: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    border: string;
    separator: string;
    success: string;
    warning: string;
    danger: string;
    shadow: string;
}

const lightColors: ColorPalette = {
    background: '#F0F2F5',
    surface: '#FFFFFF',
    surfaceHighlight: '#E6ECF2',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textHint: '#BDC3C7',
    primary: '#4CAF50',         // Changed from blue to green
    primaryLight: '#81C784',   // Changed to a lighter green
    primaryDark: '#388E3C',      // Changed to a darker green
    secondary: '#26A69A',      // Changed from blue to a teal/green
    border: '#D5DBDB',
    separator: '#EBEBEB',
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
    shadow: 'rgba(0, 0, 0, 0.1)',
};

const darkColors: ColorPalette = {
    background: '#141414',
    surface: '#2C2C2E',
    surfaceHighlight: '#48484A',
    text: '#F2F2F7',
    textSecondary: '#A9A9AE',
    textHint: '#6B6B6D',
    primary: '#32D74B',         // Changed from blue to a vibrant green
    primaryLight: '#5EE371',   // Changed to a lighter green
    primaryDark: '#28A745',      // Changed to a darker green
    secondary: '#FF453A',       // Unchanged (was not blue)
    border: '#444446',
    separator: '#3A3A3C',
    success: '#30D158',
    warning: '#FFD60A',
    danger: '#FF453A',
    shadow: 'rgba(0, 0, 0, 0.4)',
};

export const colors = {
    light: lightColors,
    dark: darkColors,
};

export const getThemeColors = (theme: Theme): ColorPalette => {
    return colors[theme];
};