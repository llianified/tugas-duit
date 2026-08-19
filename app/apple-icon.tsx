import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#635BFF',
        }}
      >
        <svg width="132" height="132" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M256 84C161.023 84 84 161.023 84 256C84 350.977 161.023 428 256 428C350.977 428 428 350.977 428 256C428 161.023 350.977 84 256 84ZM256 142C265.2 199 313 246.8 370 256C313 265.2 265.2 313 256 370C246.8 313 199 265.2 142 256C199 246.8 246.8 199 256 142Z"
          />
        </svg>
      </div>
    ),
    size,
  )
}
