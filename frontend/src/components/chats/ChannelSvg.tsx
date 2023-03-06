interface SvgProps {
  width?: string; // SVG width
  height?: string; // SVG height
  fill?: string; // SVG Fill color (background)
  stroke?: string; // SVG Stroke color (line)
  strokeWidth?: number; // SVG Stroke width (line width)
}
import '../../style/Chats.css';

export function UsersIcon({ width, height, stroke, strokeWidth }: SvgProps) {
  return (
    <svg
      className="channelSvgIcon"
      width={width || '1rem'}
      height={height || '1rem'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 3.46776C17.4817 4.20411 18.5 5.73314 18.5 7.5C18.5 9.26686 17.4817 10.7959 16 11.5322M18 16.7664C19.5115 17.4503 20.8725 18.565 22 20M2 20C3.94649 17.5226 6.58918 16 9.5 16C12.4108 16 15.0535 17.5226 17 20M14 7.5C14 9.98528 11.9853 12 9.5 12C7.01472 12 5 9.98528 5 7.5C5 5.01472 7.01472 3 9.5 3C11.9853 3 14 5.01472 14 7.5Z"
        stroke={stroke || '#3d4f73'}
        strokeWidth={strokeWidth || 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DmChannelIcon({
  width,
  height,
  stroke,
  strokeWidth,
}: SvgProps) {
  return (
    <svg
      className="channelSvgIcon"
      width={width || '1rem'}
      height={height || '1rem'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 4L3 9.31372L10.5 13.5M20 4L14.5 21L10.5 13.5M20 4L10.5 13.5"
        stroke={stroke || '#3d4f73'}
        strokeWidth={strokeWidth || 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MsgNotificationIcon({
  width,
  height,
  stroke,
  strokeWidth,
}: SvgProps) {
  return (
    <svg
      className="channelSvgIcon"
      width={width || '1rem'}
      height={height || '1rem'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.0002 19C15.0002 20.6569 13.6571 22 12.0002 22C10.3434 22 9.00025 20.6569 9.00025 19M13.7968 6.23856C14.2322 5.78864 14.5002 5.17562 14.5002 4.5C14.5002 3.11929 13.381 2 12.0002 2C10.6195 2 9.50025 3.11929 9.50025 4.5C9.50025 5.17562 9.76825 5.78864 10.2037 6.23856M2.54707 8.32296C2.53272 6.87161 3.3152 5.51631 4.57928 4.80306M21.4534 8.32296C21.4678 6.87161 20.6853 5.51631 19.4212 4.80306M18.0002 11.2C18.0002 9.82087 17.3681 8.49823 16.2429 7.52304C15.1177 6.54786 13.5915 6 12.0002 6C10.4089 6 8.88283 6.54786 7.75761 7.52304C6.63239 8.49823 6.00025 9.82087 6.00025 11.2C6.00025 13.4818 5.43438 15.1506 4.72831 16.3447C3.92359 17.7056 3.52122 18.3861 3.53711 18.5486C3.55529 18.7346 3.58876 18.7933 3.73959 18.9036C3.87142 19 4.53376 19 5.85844 19H18.1421C19.4667 19 20.1291 19 20.2609 18.9036C20.4117 18.7933 20.4452 18.7346 20.4634 18.5486C20.4793 18.3861 20.0769 17.7056 19.2722 16.3447C18.5661 15.1506 18.0002 13.4818 18.0002 11.2Z"
        stroke={stroke || '#3d4f73'}
        strokeWidth={strokeWidth || 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProtectedChannelIcon({
  width,
  height,
  stroke,
  strokeWidth,
}: SvgProps) {
  return (
    <svg
      className="channelSvgIcon"
      width={width || '1rem'}
      height={height || '1rem'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 10V8C17 5.23858 14.7614 3 12 3C9.23858 3 7 5.23858 7 8V10M12 14.5V16.5M8.8 21H15.2C16.8802 21 17.7202 21 18.362 20.673C18.9265 20.3854 19.3854 19.9265 19.673 19.362C20 18.7202 20 17.8802 20 16.2V14.8C20 13.1198 20 12.2798 19.673 11.638C19.3854 11.0735 18.9265 10.6146 18.362 10.327C17.7202 10 16.8802 10 15.2 10H8.8C7.11984 10 6.27976 10 5.63803 10.327C5.07354 10.6146 4.6146 11.0735 4.32698 11.638C4 12.2798 4 13.1198 4 14.8V16.2C4 17.8802 4 18.7202 4.32698 19.362C4.6146 19.9265 5.07354 20.3854 5.63803 20.673C6.27976 21 7.11984 21 8.8 21Z"
        stroke={stroke || '#3d4f73'}
        strokeWidth={strokeWidth || 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PrivateChannelIcon({
  width,
  height,
  stroke,
  strokeWidth,
}: SvgProps) {
  return (
    <svg
      className="channelSvgIcon"
      width={width || '1rem'}
      height={height || '1rem'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.7429 5.09232C11.1494 5.03223 11.5686 5 12.0004 5C17.1054 5 20.4553 9.50484 21.5807 11.2868C21.7169 11.5025 21.785 11.6103 21.8231 11.7767C21.8518 11.9016 21.8517 12.0987 21.8231 12.2236C21.7849 12.3899 21.7164 12.4985 21.5792 12.7156C21.2793 13.1901 20.8222 13.8571 20.2165 14.5805M6.72432 6.71504C4.56225 8.1817 3.09445 10.2194 2.42111 11.2853C2.28428 11.5019 2.21587 11.6102 2.17774 11.7765C2.1491 11.9014 2.14909 12.0984 2.17771 12.2234C2.21583 12.3897 2.28393 12.4975 2.42013 12.7132C3.54554 14.4952 6.89541 19 12.0004 19C14.0588 19 15.8319 18.2676 17.2888 17.2766M3.00042 3L21.0004 21M9.8791 9.87868C9.3362 10.4216 9.00042 11.1716 9.00042 12C9.00042 13.6569 10.3436 15 12.0004 15C12.8288 15 13.5788 14.6642 14.1217 14.1213"
        stroke={stroke || '#3d4f73'}
        strokeWidth={strokeWidth || 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
