/**
 * Color extraction utility for extracting dominant colors from images
 * Used for dynamic theming based on icon colors
 */

/**
 * RGB color interface
 */
export interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Extract the dominant color from an image URL
 * @param imageUrl - URL of the image to analyze
 * @param quality - Sampling quality (1-10, higher = slower but more accurate)
 * @returns Promise resolving to RGB color object
 */
export async function extractDominantColor(
  imageUrl: string,
  quality: number = 5
): Promise<RGB> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // Set canvas size to image size
        canvas.width = img.width
        canvas.height = img.height

        // Draw image to canvas
        ctx.drawImage(img, 0, 0)

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        // Color counting map
        const colorCounts: Map<string, { count: number; rgb: RGB }> = new Map()

        // Sample pixels based on quality (higher quality = more samples)
        const step = quality * 4 // Skip pixels for performance

        for (let i = 0; i < pixels.length; i += step) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]

          // Skip transparent or near-transparent pixels
          if (a < 125) continue

          // Skip very dark or very light pixels (likely shadows or highlights)
          const brightness = (r + g + b) / 3
          if (brightness < 30 || brightness > 225) continue

          // Quantize colors to reduce noise
          const quantizedR = Math.round(r / 10) * 10
          const quantizedG = Math.round(g / 10) * 10
          const quantizedB = Math.round(b / 10) * 10

          const key = `${quantizedR},${quantizedG},${quantizedB}`

          if (colorCounts.has(key)) {
            colorCounts.get(key)!.count++
          } else {
            colorCounts.set(key, {
              count: 1,
              rgb: { r: quantizedR, g: quantizedG, b: quantizedB },
            })
          }
        }

        // Find the most common color
        let dominantColor: RGB = { r: 100, g: 100, b: 100 } // Default gray
        let maxCount = 0

        colorCounts.forEach((value) => {
          if (value.count > maxCount) {
            maxCount = value.count
            dominantColor = value.rgb
          }
        })

        resolve(dominantColor)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }

    img.src = imageUrl
  })
}

/**
 * Convert RGB to OKLCH format for CSS
 * @param rgb - RGB color object
 * @returns OKLCH color string
 */
export function rgbToOklch(rgb: RGB): string {
  // First convert RGB to linear RGB
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  // Convert to linear RGB (inverse sRGB gamma)
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  const rLinear = toLinear(r)
  const gLinear = toLinear(g)
  const bLinear = toLinear(b)

  // Convert to XYZ (D65 illuminant)
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750
  const z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041

  // Convert XYZ to OKLab (approximation)
  const l = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z)

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bVal = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  // Convert to cylindrical coordinates (OKLCH)
  const C = Math.sqrt(a * a + bVal * bVal)
  const h = Math.atan2(bVal, a) * (180 / Math.PI)
  const hue = h < 0 ? h + 360 : h

  // Return OKLCH string with reasonable precision
  return `${L.toFixed(3)} ${C.toFixed(3)} ${hue.toFixed(1)}`
}

/**
 * Convert RGB to hex color string
 * @param rgb - RGB color object
 * @returns Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

/**
 * Check if a color is considered "bright" or "dark"
 * @param rgb - RGB color object
 * @returns true if the color is bright, false if dark
 */
export function isColorBright(rgb: RGB): boolean {
  // Calculate perceived brightness using the luminance formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 155
}
