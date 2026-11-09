import { Divider } from './catalyst/divider'

export function Stat({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return (
    <div>
      <Divider />
      <div className="mt-6 text-lg/6 font-medium sm:text-sm/6">{title}</div>
      <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">{value}</div>
      {detail && <div className="mt-3 text-sm/6 text-zinc-500">{detail}</div>}
    </div>
  )
}
