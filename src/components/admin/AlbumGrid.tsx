'use client'

import { useAlbumStore } from '@/stores/album-store'
import { formattedDate } from '@/data/albums'
import PolaroidGallery from '@/components/PolaroidGallery'
import type { AlbumItem } from '@/data/albums'
import { Edit3, Trash2, ChevronUp, ChevronDown, Camera } from 'lucide-react'

export default function AlbumGrid() {
  const {
    albums,
    isEditMode,
    openAdmin,
    deleteAlbum,
    moveAlbum,
  } = useAlbumStore()

  const displayAlbums = albums

  const handleDeleteAlbum = (album: AlbumItem) => {
    if (confirm(`确定要删除「${album.event || album.title || '未命名'}」及其所有照片吗？此操作不可撤销。`)) {
      deleteAlbum(album.id)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayAlbums.map((album, index) => (
          <div
            key={album.id}
            className="bg-base-100 rounded-2xl overflow-hidden shadow-sm border border-base-200 hover:shadow-xl transition-all duration-300 animate-fade-in-up group"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Admin actions bar — only in edit mode */}
            {isEditMode && (
              <div className="flex items-center justify-between px-4 pt-3 pb-0">
                <span className="text-xs text-base-content/30 bg-base-200 px-2 py-0.5 rounded-full">
                  #{index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => index > 0 && moveAlbum(index, index - 1)}
                    disabled={index === 0}
                    className="btn btn-xs btn-ghost text-base-content/30 hover:text-base-content disabled:opacity-10"
                    title="上移"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => index < displayAlbums.length - 1 && moveAlbum(index, index + 1)}
                    disabled={index === displayAlbums.length - 1}
                    className="btn btn-xs btn-ghost text-base-content/30 hover:text-base-content disabled:opacity-10"
                    title="下移"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openAdmin(album.id)}
                    className="btn btn-xs btn-ghost text-primary hover:bg-primary/10 gap-1 ml-1"
                    title="编辑相册"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeleteAlbum(album)}
                    className="btn btn-xs btn-ghost text-error/60 hover:text-error hover:bg-error/10"
                    title="删除相册"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Card content */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {album.icon && <span className="text-xl">{album.icon}</span>}
                    <a
                      href={`/photo-wall?id=${album.id}`}
                      className="text-primary hover:underline"
                    >
                      {album.event}
                    </a>
                  </h2>
                  {album.title && (
                    <p className="text-sm text-base-content/60">{album.title}</p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap bg-base-200/50 px-3 py-1 rounded-full">
                  {formattedDate(album.date)}
                </span>
              </div>
              {album.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{album.description}</p>
              )}
              {album.photos && album.photos.length > 0 && (
                <span className="text-xs text-base-content/30 mt-1 inline-flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {album.photos.length} 张照片
                </span>
              )}
            </div>

            {/* Polaroid gallery preview */}
            {album.photos && album.photos.length > 0 && (
              <div className="px-4 pb-4 overflow-visible">
                <div className="relative w-full overflow-visible" style={{ minHeight: '200px' }}>
                  <PolaroidGallery
                    images={album.photos}
                    event={album.id}
                    title={album.title}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {displayAlbums.length === 0 && (
        <div className="text-center py-20 text-base-content/30">
          <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">还没有相册</p>
          <p className="text-sm mt-1">点击上方「新建相册」开始记录美好瞬间</p>
        </div>
      )}
    </div>
  )
}
