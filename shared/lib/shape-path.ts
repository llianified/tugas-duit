import type { ShapeKey } from '@/features/captcha/domain'

export const SHAPE_PATH: Record<ShapeKey, string> = {
  circle: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z',
  square: 'M4.5 4.5h15v15h-15z',
  triangle: 'M12 4l8 15.5H4z',
  star: 'M12 3.75l2.6 5.4 5.9.8-4.3 4.1 1.05 5.85L12 17.15 6.75 19.9 7.8 14.05 3.5 9.95l5.9-.8z',
  heart:
    'M12 20.25S3.75 15.4 3.75 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.25 2.3c0 5.5-8.25 10.35-8.25 10.35z',
  diamond: 'M12 3.5L20.5 12 12 20.5 3.5 12z',
  hexagon: 'M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z',
  pentagon: 'M12 3.5l8.5 6.2-3.25 10H6.75L3.5 9.7z',
  cross: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
}
