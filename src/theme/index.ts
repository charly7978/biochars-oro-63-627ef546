
import { colors } from './colors';
import { fontSizes } from './fontSizes';
import { keyframes } from './keyframes';
import { animations } from './animations';
import { screens } from './screens';
import { utilities } from './utilities';

export const theme = {
  container: {
    center: true,
    padding: "2rem",
    screens: {
      "2xl": "1400px",
    },
  },
  extend: {
    colors,
    fontSize: fontSizes,
    keyframes,
    animation: animations,
    screens,
  },
};

export { utilities };
