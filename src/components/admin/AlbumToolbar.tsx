'use client'

import { useRef } from 'react'
import { useAlbumStore } from '@/stores/album-store'
import { useAuthStore } from '@/components/write/hooks/use-auth'
import { readFileAsText } from '@/lib/file-utils'
import { toast } from 'sonner'
import { generateAlbumId, type AlbumItem } from '@/data/albums'

export default function AlbumToolbar() {
  const {
    isEditMode,
    isSaving,
    toggleEditMode,
    saveAlbums,
    addAlbum,
    openAdmin,
  } = useAlbumStore()

  const { isAuth, setPrivateKey } = useAuthStore()
  const keyInputRef = useRef<HTMLInputElement>(null)

  const onChoosePrivateKey = async (file: File) => {
    const pem = await readFileAsText(file)
    setPrivateKey(pem)
    toast.success('密钥导入成功')
  }

  const handleSave = async () => {
    if (!isAuth) {
      toast.error('请先导入密钥后再保存')
      keyInputRef.current?.click()
      return
    }
    await saveAlbums()
  }

  const handleAddAlbum = () => {
    const newAlbum: AlbumItem = {
      id: generateAlbumId(),
      date: new Date().toISOString().split('T')[0],
      event: '新相册',
      title: '',
      description: '',
      icon: '📷',
      photos: [],
    }
    addAlbum(newAlbum)
    openAdmin(newAlbum.id)
  }

  if (!isEditMode) {
    return (
      <button
        onClick={toggleEditMode}
        className="btn btn-sm btn-primary gap-2 rounded-xl font-semibold shadow-lg shadow-primary/20 shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        编辑相册
      </button>
    )
  }

  return (
    <>
      {/* Hidden .pem file input */}
      <input
        ref={keyInputRef}
        type="file"
        accept=".pem"
        className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          if (f) await onChoosePrivateKey(f)
          if (e.currentTarget) e.currentTarget.value = ''
        }}
      />

      <div className="flex gap-3 shrink-0">
        <button
          onClick={toggleEditMode}
          className="btn btn-sm btn-ghost rounded-xl border bg-base-100/60 font-semibold"
        >
          取消
        </button>
        <button
          onClick={() => keyInputRef.current?.click()}
          disabled={isAuth}
          className={`btn btn-sm rounded-xl font-semibold ${
            isAuth ? 'btn-ghost text-success' : 'btn-outline'
          }`}
        >
          {isAuth ? '已导入' : '导入密钥'}
        </button>
        <button
          onClick={handleAddAlbum}
          className="btn btn-sm btn-outline gap-1 rounded-xl font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          添加
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-sm btn-primary px-6 shadow-lg shadow-primary/20 font-semibold"
        >
          {isSaving ? '提交中...' : '保存'}
        </button>
      </div>

      {isSaving && (
        <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <div className="bg-base-100 p-8 rounded-2xl shadow-2xl border border-base-200 text-center max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-bold mb-2">正在同步到远程仓库...</h3>
            <p className="text-base-content/60 text-sm">
              正在上传照片文件并更新配置数据，请勿关闭页面或刷新浏览器。进度会通过右上角的提示框显示...
            </p>
          </div>
        </div>
      )}
    </>
  )
}
