import React from 'react'
import { Box, Button, Card, CardContent, Divider, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField, Typography } from '@mui/material'
import { Mode, Platform, createTask, deleteVideo, getCountries, getTask, sendUnique } from '../api'

type Props = { platform: Platform; onError: (msg: string) => void }

export const PlatformColumn: React.FC<Props> = ({ platform, onError }) => {
  const [mode, setMode] = React.useState<Mode>('trends')
  const [keywords, setKeywords] = React.useState('')
  const [countries, setCountries] = React.useState<{code: string|null, name: string}[]>([])
  const [country, setCountry] = React.useState<string|''>('') // ''=Глобально
  const [count, setCount] = React.useState(5)
  const [task, setTask] = React.useState<any | null>(null)
  const [videos, setVideos] = React.useState<any[]>([])
  const [taskErrors, setTaskErrors] = React.useState<string[]>([])
  const [logs, setLogs] = React.useState<{level:string, message:string, ts:string}[]>([] as any)
  const failCountRef = React.useRef(0)
  const intervalRef = React.useRef<any>(null)
  const stallCountRef = React.useRef(0)
  const lastSnapshotRef = React.useRef<string>('')

  React.useEffect(() => {
    getCountries().then(setCountries).catch(() => setCountries([{ code: null as any, name: 'Глобально' }]))
  }, [])

  React.useEffect(() => {
    if (!task?.taskId) return
    const poll = async () => {
      try {
        const data = await getTask(platform, task.taskId)
        setTask((prev: any) => ({ ...prev, status: data.status, progress: data.progress }))
        setVideos(data.videos || [])
        setTaskErrors(data.errorMessages || [])
        setLogs(data.logs || [])
        // stall detection
        const snapshot = JSON.stringify({ s: data.status, p: data.progress?.downloaded, t: data.progress?.total, r: (data.videos||[]).filter((v:any)=>v.status==='ready').length })
        if (snapshot === lastSnapshotRef.current) {
          stallCountRef.current += 1
        } else {
          stallCountRef.current = 0
          lastSnapshotRef.current = snapshot
        }
        // Stop polling on terminal states or error
        if (data.status === 'completed' || data.status === 'error') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          if (data.status === 'error' && (data.errorMessages?.length)) {
            onError(`Задача завершилась с ошибкой: ${data.errorMessages.join(' | ')}`)
          }
        } else if (stallCountRef.current >= Number(import.meta.env.VITE_POLL_STALL_MAX || 30)) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          onError('Нет прогресса по задаче, остановлен поллинг')
        } else {
          failCountRef.current = 0
        }
      } catch (e: any) {
        failCountRef.current += 1
        const message = e?.error?.message || e?.message || 'Ошибка получения статуса'
        onError(message)
        if (failCountRef.current >= 3) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }
    // initial call
    poll()
    // set interval
    intervalRef.current = setInterval(poll, Number(import.meta.env.VITE_POLL_INTERVAL_MS || 2000))
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = null }
  }, [task?.taskId, platform])

  const submit = async () => {
    try {
      const payload = {
        mode,
        keywords: mode === 'search' ? keywords : undefined,
        regionName: country ? countries.find(c => c.code === country)?.name : 'Глобально',
        regionCode: country || null,
        count,
      }
      const data = await createTask(platform, payload as any)
      setTask(data)
      setVideos([])
      setTaskErrors([])
      failCountRef.current = 0
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Ошибка создания задачи'
      onError(msg)
    }
  }

  const remove = async (id: string) => {
    const prev = videos
    setVideos(videos.filter(v => v.platformVideoId !== id))
    try {
      await deleteVideo(platform, id)
    } catch (e: any) {
      onError('Не удалось удалить')
      setVideos(prev)
    }
  }

  const unique = async (id: string) => {
    try {
      await sendUnique(platform, id)
    } catch (e: any) {
      onError(e?.error?.message || 'Уникализация недоступна')
    }
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>{platform.toUpperCase()}</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant={mode==='trends'?'contained':'outlined'} onClick={() => setMode('trends')}>Тренды</Button>
          <Button variant={mode==='search'?'contained':'outlined'} onClick={() => setMode('search')}>Поиск</Button>
        </Stack>
        {mode==='search' && (
          <TextField fullWidth size="small" label="Ключевые слова" value={keywords} onChange={e=>setKeywords(e.target.value)} sx={{ mb: 2 }} />
        )}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Регион</InputLabel>
            <Select value={country} label="Регион" onChange={(e: SelectChangeEvent) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <MenuItem key={String(c.code)} value={c.code || ''}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField type="number" size="small" label="Кол-во" value={count} onChange={e=>setCount(Math.max(1, Math.min(10, Number(e.target.value))))} inputProps={{ min:1, max:10 }} />
        </Stack>
        <Button variant="contained" onClick={submit}>Создать задачу</Button>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>Результаты</Typography>
        {task?.status === 'error' && taskErrors.length > 0 && (
          <Box sx={{ mb: 2, p: 1, border: '1px solid #f44336', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="error">Ошибки задачи</Typography>
            {taskErrors.map((m, i) => (
              <Typography key={i} variant="caption" color="error" sx={{ display: 'block' }}>{m}</Typography>
            ))}
          </Box>
        )}
        {logs.length > 0 && (
          <Box sx={{ mb: 2, p: 1, border: '1px dashed #aaa', borderRadius: 1, maxHeight: 160, overflow: 'auto' }}>
            <Typography variant="subtitle2">Журнал</Typography>
            {logs.map((l:any, i:number) => (
              <Typography key={i} variant="caption" color={l.level==='error'?'error':(l.level==='warn'?'warning':'text.secondary')} sx={{ display: 'block' }}>
                [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.message}
              </Typography>
            ))}
          </Box>
        )}
        <Stack spacing={1}>
          {videos.length === 0 && <Typography color="text.secondary">Нет результатов</Typography>}
          {videos.map(v => (
            <Box key={v.platformVideoId} sx={{ border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                {v.previewUrl && <img src={v.previewUrl} alt="preview" width={96} />}
                <Box sx={{ flex: 1 }}>
                  <Typography noWrap>{v.title || v.platformVideoId}</Typography>
                  <Typography variant="caption" color="text.secondary">{v.author}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Статус: {v.status}</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" href={`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/videos/${platform}/${v.platformVideoId}/download`} disabled={!v.downloadPath}>Скачать</Button>
                  <Button size="small" variant="outlined" color="secondary" onClick={() => unique(v.platformVideoId)}>Отправить на уникализацию</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => remove(v.platformVideoId)}>Удалить</Button>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
