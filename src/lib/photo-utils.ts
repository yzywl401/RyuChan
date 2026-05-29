import type { Photo } from '@/data/albums'

export function detectVariant(width: number, height: number): Photo['variant'] {
  const ratio = width / height
  const variants: { v: Photo['variant']; r: number }[] = [
    { v: '1x1', r: 1 },
    { v: '4x3', r: 4 / 3 },
    { v: '4x5', r: 4 / 5 },
    { v: '9x16', r: 9 / 16 },
  ]
  let closest = variants[0]
  let minDiff = Math.abs(ratio - closest.r)
  for (const item of variants) {
    const diff = Math.abs(ratio - item.r)
    if (diff < minDiff) {
      minDiff = diff
      closest = item
    }
  }
  return closest.v
}

export function detectVariantFromUrl(url: string): Promise<Photo['variant']> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      
      const timeoutId = setTimeout(() => {
        img.src = ''
        resolve('1x1')
      }, 5000)

      img.onload = () => {
        clearTimeout(timeoutId)
        resolve(detectVariant(img.naturalWidth, img.naturalHeight))
      }
      
      img.onerror = () => {
        clearTimeout(timeoutId)
        resolve('1x1')
      }
      
      img.src = url
    } catch (e) {
      resolve('1x1')
    }
  })
}
