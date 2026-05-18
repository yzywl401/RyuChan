'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAlbumStore } from '@/stores/album-store'
import type { AlbumItem, Photo } from '@/data/albums'

interface Props {
  initialAlbum: AlbumItem | null
  event?: string
}

const VARIANT_RATIO: Record<string, string> = {
  '1x1': '1 / 1',
  '4x3': '4 / 3',
  '4x5': '4 / 5',
  '9x16': '9 / 16',
}

function PhotoImage({ photo }: { photo: Photo }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200 text-base-content/20 p-4">
        <ImageOff className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-xs text-center opacity-40">图片加载失败</p>
        <p className="text-[10px] text-center opacity-20 mt-1 truncate max-w-full px-2">
          {photo.src}
        </p>
      </div>
    )
  }

  return (
    <img
      src={photo.src}
      alt={photo.title || ''}
      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
      loading="lazy"
      onError={() => setError(true)}
    />
  )
}

export default function PhotoWallGrid({ initialAlbum, event }: Props) {
  const { isEditMode, reorderPhotos } = useAlbumStore()

  const getAlbumIdFromURL = (): string => {
    if (typeof window === 'undefined') return event || ''
    const params = new URLSearchParams(window.location.search)
    return params.get('id') || event || ''
  }

  const albumId = initialAlbum?.id || getAlbumIdFromURL()

  const getAlbumFromStore = useCallback((): AlbumItem | undefined => {
    if (!albumId) return undefined
    return useAlbumStore.getState().albums.find((a) => a.id === albumId)
  }, [albumId])

  const getPhotosFromStore = useCallback((): Photo[] => {
    return getAlbumFromStore()?.photos || []
  }, [getAlbumFromStore])

  const [photos, setPhotos] = useState<Photo[]>(() => {
    const storePhotos = getPhotosFromStore()
    if (storePhotos.length > 0) return storePhotos
    return initialAlbum?.photos || []
  })

  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      const storePhotos = getPhotosFromStore()
      if (storePhotos.length > 0) {
        setPhotos(storePhotos)
      }
    }

    if (!albumId) return

    const unsub = useAlbumStore.subscribe((state, prevState) => {
      if (state.albums === prevState.albums) return
      const album = state.albums.find((a) => a.id === albumId)
      if (album) {
        setPhotos(album.photos || [])
      }
    })

    return unsub
  }, [albumId, getPhotosFromStore])

  const [colCount, setColCount] = useState(3)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w >= 1024) setColCount(3)
      else if (w >= 640) setColCount(2)
      else setColCount(1)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const cols: Photo[][] = Array.from({ length: colCount }, () => [])
  photos.forEach((photo, i) => {
    cols[i % colCount].push(photo)
  })

  return (
    <div>
      {photos.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-16 h-16 mx-auto mb-3 text-base-content/20" />
          <p className="text-lg text-base-content/30">暂无照片</p>
          {isEditMode && (
            <p className="text-sm text-base-content/30 mt-1">
              返回相册管理面板添加照片
            </p>
          )}
        </div>
      ) : (
        <div id="photo-wall-grid" className="flex gap-4 items-start">
          {cols.map((colPhotos, colIdx) => (
            <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-4">
              {colPhotos.map((photo, row) => {
                const idx = colIdx + row * colCount
                return (
                  <div
                    key={`${photo.src}-${idx}`}
                    className="w-full bg-base-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-base-200 group"
                  >
                    <div
                      className="w-full relative overflow-hidden bg-base-200"
                      style={{ aspectRatio: VARIANT_RATIO[photo.variant] || '1 / 1' }}
                    >
                      <PhotoImage photo={photo} />
                    </div>

                    <div className="p-5">
                      <div className="min-h-[88px]">
                        <h3 className="text-xl font-bold mb-2">{photo.title}</h3>
                        {photo.description && (
                          <p className="text-base-content/70 text-sm">{photo.description}</p>
                        )}
                      </div>

                      {isEditMode && (
                        <div className="flex items-center justify-center gap-3 pt-3">
                          <button
                            onClick={() => idx > 0 && reorderPhotos(albumId, idx, idx - 1)}
                            disabled={idx === 0}
                            className="btn btn-sm btn-primary btn-outline gap-1.5"
                            title="前移"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> 前移
                          </button>
                          <span className="text-sm font-semibold text-base-content/40 tabular-nums min-w-[3rem] text-center">
                            {idx + 1} / {photos.length}
                          </span>
                          <button
                            onClick={() => idx < photos.length - 1 && reorderPhotos(albumId, idx, idx + 1)}
                            disabled={idx === photos.length - 1}
                            className="btn btn-sm btn-primary btn-outline gap-1.5"
                            title="后移"
                          >
                            后移 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
