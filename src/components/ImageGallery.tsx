import { useRef, useState } from 'react'
import { PhotoIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { api } from '../api'
import type { OrderImage } from '../types'
import { useAuth } from '../auth'
import { Button } from './catalyst/button'
import { Dialog, DialogTitle } from './catalyst/dialog'
import { ErrorAlert } from './Loading'

export function ImageGallery({ orderId, creatorId, images, onChange }: { orderId: string; creatorId: string; images: OrderImage[]; onChange: (images: OrderImage[]) => void }) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<OrderImage | null>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError('')
    const body = new FormData()
    Array.from(files).forEach((file) => body.append('images', file))
    try {
      const uploaded = await api<OrderImage[]>(`/orders/${orderId}/images`, { method: 'POST', body })
      onChange([...uploaded, ...images])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить изображения') }
    finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(image: OrderImage) {
    try {
      await api(`/orders/${orderId}/images/${image.id}`, { method: 'DELETE' })
      onChange(images.filter((item) => item.id !== image.id))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить изображение') }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
      <Button outline onClick={() => inputRef.current?.click()} disabled={busy}><PlusIcon />{busy ? 'Загрузка…' : 'Добавить изображения'}</Button>
      <span className="ml-3 text-xs text-zinc-500">JPG, PNG, GIF, WebP или AVIF</span>
      <ErrorAlert>{error}</ErrorAlert>
      {images.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 flex w-full flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-white/5">
          <PhotoIcon className="mb-3 size-8 text-zinc-400" />Добавьте макеты, референсы или фотографии
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:ring-white/10">
              <button type="button" className="block aspect-square w-full" onClick={() => setPreview(image)}>
                <img src={`/api/orders/${orderId}/images/${image.id}`} alt={image.originalName} className="size-full object-cover transition group-hover:scale-105" />
              </button>
              {(user?.id === image.uploadedBy || user?.id === creatorId) && <Button plain className="absolute top-2 right-2 bg-white/90 shadow-sm" aria-label="Удалить изображение" onClick={() => void remove(image)}><TrashIcon /></Button>}
              <div className="truncate px-3 py-2 text-xs text-zinc-500" title={image.originalName}>{image.originalName}</div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} size="4xl">
        <DialogTitle className="truncate pr-8">{preview?.originalName}</DialogTitle>
        {preview && <img src={`/api/orders/${orderId}/images/${preview.id}`} alt={preview.originalName} className="mt-6 max-h-[75vh] w-full rounded-lg object-contain" />}
      </Dialog>
    </div>
  )
}
