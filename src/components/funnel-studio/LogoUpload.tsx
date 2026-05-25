import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onUpload: (base64: string, ext: string, preview: string) => void
  preview?: string
}

export function LogoUpload({ onUpload, preview }: Props) {
  const [error, setError] = useState('')

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setError('')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        onUpload(base64, ext, dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: () => setError('File too large or unsupported format (PNG, SVG, WebP, JPG)'),
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input {...getInputProps()} />
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Logo preview" className="max-h-20 max-w-48 object-contain" />
            <p className="text-sm text-muted-foreground">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p className="font-medium text-sm">
              {isDragActive ? 'Drop logo here' : 'Drag & drop your logo'}
            </p>
            <p className="text-xs">or click to browse — PNG, SVG, WebP, JPG (max 5MB)</p>
          </div>
        )}
      </div>
      {error && <p className="text-destructive text-xs mt-2">{error}</p>}
    </div>
  )
}
