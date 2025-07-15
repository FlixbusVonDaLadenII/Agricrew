export type Theme = 'light' | 'dark';

interface ColorPalette {
    background: string;
    surface: string; // For cards, input fields, raised elements
    surfaceHighlight: string; // For slightly elevated elements, or focused states
    text: string;
    textSecondary: string;
    textHint: string; // For placeholders
    primary: string; // Main interactive color (buttons, links, active states)
    primaryLight: string; // Lighter version for subtle effects or gradients
    primaryDark: string; // Darker version for accents or hover
    secondary: string; // Complementary accent color (e.g., for icons, secondary buttons)
    border: string; // Subtle borders
    separator: string; // Dividers
    success: string;
    warning: string;
    danger: string;
}

const lightColors: ColorPalette = {
    background: '#F0F2F5', // Light grey-blue for main background
    surface: '#FFFFFF',    // Pure white for cards, sections
    surfaceHighlight: '#E6ECF2', // Very light grey-blue for highlights/focus
    text: '#2C3E50',       // Dark blue-grey for primary text
    textSecondary: '#7F8C8D', // Muted grey for secondary text
    textHint: '#BDC3C7',   // Light grey for placeholders
    primary: '#2ECC71',    // Vibrant Green (fresh, growth)
    primaryLight: '#58D68D', // Lighter green for gradients
    primaryDark: '#28B463', // Darker green for depth
    secondary: '#3498DB',  // Sky Blue (complementary, clean)
    border: '#D5DBDB',     // Light grey border
    separator: '#EBEBEB',  // Lighter separator
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
};

const darkColors: ColorPalette = {
    background: '#1A202C', // Deep dark blue-grey
    surface: '#2D3748',    // Darker blue-grey for cards, sections
    surfaceHighlight: '#4A5568', // Slightly lighter dark grey for highlights/focus
    text: '#EDF2F7',       // Off-white for primary text
    textSecondary: '#A0AEC0', // Lighter grey for secondary text
    textHint: '#6B7A8B',   // Darker grey for placeholders
    primary: '#2ECC71',    // Vibrant Green (same primary for consistency)
    primaryLight: '#58D68D', // Lighter green for gradients
    primaryDark: '#28B463', // Darker green for depth
    secondary: '#3498DB',  // Sky Blue (same secondary for consistency)
    border: '#4A5568',     // Dark grey border
    separator: '#3A4459',  // Darker separator
    success: '#28A745',
    warning: '#FFC107',
    danger: '#DC3545',
};

export const colors = {
    light: lightColors,
    dark: darkColors,
};

export const getThemeColors = (theme: Theme): ColorPalette => {
    return colors[theme];
};