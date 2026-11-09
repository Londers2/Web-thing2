import * as Headless from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import { Button } from './catalyst/button'

export function SidePanel({ open, onClose, title, subtitle, children, scroll = true }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; scroll?: boolean }) {
  return (
    <Headless.Dialog open={open} onClose={onClose} className="relative z-50">
      <Headless.DialogBackdrop transition className="fixed inset-0 bg-zinc-950/25 transition data-closed:opacity-0 dark:bg-zinc-950/60" />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex max-w-full sm:pl-10">
          <Headless.DialogPanel transition className="flex h-full w-screen max-w-xl flex-col bg-white shadow-xl ring-1 ring-zinc-950/10 transition duration-300 ease-in-out data-closed:translate-x-full dark:bg-zinc-900 dark:ring-white/10">
            <div className="flex items-center gap-4 border-b border-zinc-950/10 px-5 py-4 dark:border-white/10">
              <div className="min-w-0 flex-1"><Headless.DialogTitle className="truncate text-base font-semibold">{title}</Headless.DialogTitle>{subtitle && <Headless.Description className="mt-1 truncate text-sm text-zinc-500">{subtitle}</Headless.Description>}</div>
              <Button plain aria-label="Закрыть" onClick={onClose}><XMarkIcon /></Button>
            </div>
            <div className={`min-h-0 flex-1 p-5 ${scroll ? 'overflow-y-auto' : 'flex flex-col overflow-hidden'}`}>{children}</div>
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  )
}
