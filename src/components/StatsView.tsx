import type { Stats } from '../types'
import { useAuth } from '../auth'
import { formatMoney } from '../utils'
import { Stat } from './Stat'

const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

export function StatsView({ stats }: { stats: Stats }) {
  const { user } = useAuth()
  const assembler = user?.jobRoles?.includes('assembler') && !user.jobRoles.includes('manager')
  const max = Math.max(1, ...stats.monthly.map((month) => month.orders))
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Всего заказов" value={stats.total} detail={`${stats.created} создано вами`} />
        <Stat title="В работе" value={stats.inProgress} detail={`${stats.new} новых`} />
        <Stat title="Завершено" value={stats.done} detail={`${stats.cancelled} отменено`} />
        <Stat title={assembler ? 'Стоимость работ' : 'Сумма заказов'} value={formatMoney(stats.amount)} detail={`Задач выполнено: ${stats.tasks.completed} из ${stats.tasks.total}`} />
      </div>
      <div className="mt-12 rounded-xl border border-zinc-950/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Заказы за 6 месяцев</h3><div className="flex gap-4 text-xs text-zinc-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-zinc-800 dark:bg-zinc-300" />Всего</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-lime-500" />Завершено</span></div></div>
        <div className="mt-8 flex h-48 items-end justify-between gap-3 sm:gap-8">
          {stats.monthly.map((month) => {
            const monthIndex = Number(month.month.slice(5, 7)) - 1
            return <div key={month.month} className="flex h-full flex-1 flex-col items-center justify-end gap-3"><div className="flex h-full w-full items-end justify-center gap-1 sm:gap-2"><div className="w-full max-w-8 rounded-t bg-zinc-300 dark:bg-zinc-700" style={{ height: `${Math.max(month.orders ? 8 : 2, month.orders / max * 100)}%` }} title={`Всего: ${month.orders}`} /><div className="w-full max-w-8 rounded-t bg-lime-500" style={{ height: `${Math.max(month.done ? 8 : 2, month.done / max * 100)}%` }} title={`Завершено: ${month.done}`} /></div><span className="text-xs text-zinc-500">{monthNames[monthIndex]}</span></div>
          })}
        </div>
      </div>
    </>
  )
}
