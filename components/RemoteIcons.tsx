import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
};

export function PowerIcon({ size = 18, color = '#1c1c1e' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3V11"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M7.05 5.8C5.2 7.14 4 9.32 4 11.8C4 15.92 7.58 19.25 12 19.25C16.42 19.25 20 15.92 20 11.8C20 9.32 18.8 7.14 16.95 5.8"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HomeIcon({ size = 20, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="5.25"
        y="6.25"
        width="13.5"
        height="11.5"
        rx="2.4"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M9 19.2H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BackIcon({ size = 28, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5.5L8 12L14.5 18.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayPauseIcon({ size = 30, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 24" fill="none">
      <Path d="M3 6.2V17.8C3 18.6 3.9 19.1 4.6 18.6L12.6 12.8C13.2 12.4 13.2 11.6 12.6 11.2L4.6 5.4C3.9 4.9 3 5.4 3 6.2Z" fill={color} />
      <Rect x="16.5" y="5.5" width="3" height="13" rx="1.2" fill={color} />
      <Rect x="22" y="5.5" width="3" height="13" rx="1.2" fill={color} />
    </Svg>
  );
}

export function MuteIcon({ size = 26, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 9.2V14.8C3.5 15.3 3.9 15.7 4.4 15.7H7.3L11.6 19.2C12.2 19.7 13 19.3 13 18.5V5.5C13 4.7 12.2 4.3 11.6 4.8L7.3 8.3H4.4C3.9 8.3 3.5 8.7 3.5 9.2Z" fill={color} />
      <Path d="M16.5 9.5L21 14M21 9.5L16.5 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function KeyboardIcon({ size = 22, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="6" width="19" height="12" rx="2.5" stroke={color} strokeWidth="1.8" />
      <Path d="M6 9.8H6.01M9.3 9.8H9.31M12.6 9.8H12.61M15.9 9.8H15.91M18 9.8H18.01M7.5 14.2H16.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </Svg>
  );
}

export function GearIcon({ size = 22, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15.2A3.2 3.2 0 1 0 12 8.8A3.2 3.2 0 0 0 12 15.2Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <Path
        d="M19.4 13.5L21 12L19.4 10.5L19.8 8.3L17.7 7.6L16.9 5.5L14.7 5.9L13.2 4.2L12 5.5L10.8 4.2L9.3 5.9L7.1 5.5L6.3 7.6L4.2 8.3L4.6 10.5L3 12L4.6 13.5L4.2 15.7L6.3 16.4L7.1 18.5L9.3 18.1L10.8 19.8L12 18.5L13.2 19.8L14.7 18.1L16.9 18.5L17.7 16.4L19.8 15.7L19.4 13.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ListIcon({ size = 22, color = '#ffffff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="11.5" rx="2" stroke={color} strokeWidth="1.8" />
      <Path d="M8.5 19.5H15.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
